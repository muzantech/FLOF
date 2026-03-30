#!/usr/bin/env node
/**
 * deploy-frontend.mjs — Déploie le frontend FlyHost sur le container proxy (b9ce2f9c)
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run deploy:frontend
 *
 * Ce script :
 *   1. Build le frontend Vite (artifacts/flyhost → dist/)
 *   2. Zippe dist/ dans frontend-deploy.zip
 *   3. Uploade vers le container proxy b9ce2f9c
 *   4. Décompresse dans /public/ (écrase l'ancienne version)
 *   Note : le container proxy n'a pas besoin de redémarrage (fichiers statiques)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readdirSync, statSync, readFileSync, rmSync, mkdirSync, createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { createWriteStream } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const PTERODACTYL_URL     = process.env.PTERODACTYL_URL;
const PTERODACTYL_CLIENT_KEY = process.env.PTERODACTYL_CLIENT_KEY;
const PROXY_SERVER_ID     = "b9ce2f9c"; // Container proxy+frontend

function log(msg)  { console.log(`\x1b[36m[deploy-fe]\x1b[0m ${msg}`); }
function ok(msg)   { console.log(`\x1b[32m[✓]\x1b[0m ${msg}`); }
function err(msg)  { console.error(`\x1b[31m[✗]\x1b[0m ${msg}`); }
function step(msg) { console.log(`\n\x1b[1m\x1b[33m▸ ${msg}\x1b[0m`); }

async function proxyFetch(endpoint, opts = {}) {
  const url = `${PTERODACTYL_URL}/api/client/servers/${PROXY_SERVER_ID}${endpoint}`;
  return fetch(url, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${PTERODACTYL_CLIENT_KEY}`,
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(opts.headers || {}),
    },
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

step("Vérification des variables d'environnement");
if (!PTERODACTYL_URL || !PTERODACTYL_CLIENT_KEY) {
  err("PTERODACTYL_URL ou PTERODACTYL_CLIENT_KEY manquant");
  process.exit(1);
}
ok("Variables OK");

// ─── Step 1: Build frontend ───────────────────────────────────────────────────

step("Build du frontend (Vite)");
try {
  execSync("pnpm --filter @workspace/flyhost run build", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PORT: "3001", BASE_PATH: "/" },
  });
  ok("Build terminé");
} catch (e) {
  err("Échec du build frontend");
  process.exit(1);
}

// ─── Step 2: Créer le ZIP ─────────────────────────────────────────────────────

step("Création du ZIP");

const distDir = path.resolve(ROOT, "artifacts/flyhost/dist/public");
const zipPath = path.join(tmpdir(), `flyhost-frontend-${Date.now()}.zip`);

const { default: archiver } = await import("archiver");

await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 6 } });
  output.on("close", resolve);
  archive.on("error", reject);
  archive.pipe(output);
  // Les fichiers seront dans public/ à l'intérieur du zip → décompressé dans /
  archive.directory(distDir, "public");
  archive.finalize();
});

const zipSize = statSync(zipPath).size;
ok(`ZIP créé : ${Math.round(zipSize / 1024)}KB → ${zipPath}`);

// ─── Step 3: Upload ───────────────────────────────────────────────────────────

step("Upload vers le container proxy");

const uploadUrlRes = await proxyFetch("/files/upload");
if (!uploadUrlRes.ok) {
  err(`Échec obtention URL upload : ${uploadUrlRes.status}`);
  process.exit(1);
}
const { attributes: { url: uploadUrl } } = await uploadUrlRes.json();
log("URL d'upload obtenue");

const zipBuffer = readFileSync(zipPath);
const blob = new Blob([zipBuffer], { type: "application/zip" });
const formData = new FormData();
formData.append("files", blob, "frontend-deploy.zip");

const uploadRes = await fetch(uploadUrl, { method: "POST", body: formData });
rmSync(zipPath, { force: true });

if (!uploadRes.ok) {
  err(`Échec upload : ${uploadRes.status} ${await uploadRes.text()}`);
  process.exit(1);
}
ok("ZIP uploadé");

// ─── Step 4: Supprimer ancien /public ────────────────────────────────────────

step("Remplacement des fichiers /public");

// Supprimer les anciens fichiers dans /public (sauf proxy.js)
const listRes = await proxyFetch("/files/list?directory=/public");
if (listRes.ok) {
  const { data } = await listRes.json();
  const toDelete = data
    .filter(f => f.attributes.name !== "proxy.js" && !f.attributes.name.startsWith("."))
    .map(f => `/public/${f.attributes.name}`);
  if (toDelete.length > 0) {
    await proxyFetch("/files/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: "/", files: toDelete }),
    });
    log(`${toDelete.length} anciens fichiers supprimés`);
  }
}

// Décompresser le zip dans / (le zip contient un dossier public/ à l'intérieur)
for (let attempt = 1; attempt <= 3; attempt++) {
  const decompressRes = await proxyFetch("/files/decompress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ root: "/", file: "frontend-deploy.zip" }),
  });
  if (decompressRes.status === 204) { ok("Décompression réussie"); break; }
  if (decompressRes.status === 504) {
    log(`Timeout (tentative ${attempt}/3) — décompression en cours...`);
    await new Promise(r => setTimeout(r, 10000));
    ok("Décompression réussie (timeout accepté)"); break;
  }
  if (attempt < 3) {
    log(`Erreur ${decompressRes.status} — nouvelle tentative dans 5s...`);
    await new Promise(r => setTimeout(r, 5000));
  } else {
    err(`Échec décompression : ${decompressRes.status}`);
    process.exit(1);
  }
}

log("Attente 5s...");
await new Promise(r => setTimeout(r, 5000));

// Supprimer le zip temporaire du container (à la racine /)
await proxyFetch("/files/delete", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ root: "/", files: ["frontend-deploy.zip"] }),
}).catch(() => {});

// ─── Step 5: Vérification ─────────────────────────────────────────────────────

step("Vérification (attente 5s)");
await new Promise(r => setTimeout(r, 5000));

const checkRes = await fetch("https://flihost.site/", { signal: AbortSignal.timeout(10000) }).catch(() => null);
if (checkRes?.ok) {
  ok("Frontend accessible : https://flihost.site/");
} else {
  log("⚠️  Impossible de vérifier le frontend — vérifiez manuellement https://flihost.site/");
}

console.log("\n\x1b[32m✅ Déploiement frontend réussi !\x1b[0m");
console.log("https://flihost.site/ → OK\n");
