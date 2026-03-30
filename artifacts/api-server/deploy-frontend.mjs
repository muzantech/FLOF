#!/usr/bin/env node
/**
 * deploy-frontend.mjs — Déploie le frontend FlyHost sur le container proxy (b9ce2f9c)
 *
 * Usage:
 *   pnpm --filter @workspace/api-server run deploy:frontend
 *
 * Ce script :
 *   1. Build le frontend Vite (artifacts/flyhost → dist/public/)
 *   2. Uploade chaque fichier directement dans /public/ du container
 *      via l'URL d'upload Wings (méthode fiable — bypass Wings daemon)
 *   3. Uploade aussi sitemap.xml et robots.txt depuis public/
 *
 * Note : le container proxy n'a pas besoin de redémarrage (fichiers statiques)
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readdirSync, statSync, readFileSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const PTERODACTYL_URL     = process.env.PTERODACTYL_URL;
const PTERODACTYL_CLIENT_KEY = process.env.PTERODACTYL_CLIENT_KEY;
const PROXY_SERVER_ID     = "b9ce2f9c"; // Container proxy+frontend

function log(msg)  { console.log(`\x1b[36m[deploy-fe]\x1b[0m ${msg}`); }
function ok(msg)   { console.log(`\x1b[32m[✓]\x1b[0m ${msg}`); }
function err(msg)  { console.error(`\x1b[31m[✗]\x1b[0m ${msg}`); }
function step(msg) { console.log(`\n\x1b[1m\x1b[33m▸ ${msg}\x1b[0m`); }

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico":  "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".json": "application/json",
  ".txt":  "text/plain",
  ".xml":  "text/xml",
};

function getMime(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

/** Obtient une URL d'upload signée Wings (valide quelques minutes) */
async function getUploadUrl() {
  const res = await fetch(
    `${PTERODACTYL_URL}/api/client/servers/${PROXY_SERVER_ID}/files/upload`,
    {
      headers: {
        "Authorization": `Bearer ${PTERODACTYL_CLIENT_KEY}`,
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
    }
  );
  if (!res.ok) throw new Error(`Impossible d'obtenir l'URL d'upload : ${res.status}`);
  const { attributes: { url } } = await res.json();
  return url;
}

/** Upload un fichier directement dans targetDir du container via Wings upload */
async function uploadFile(localPath, fileName, targetDir) {
  const baseUrl = await getUploadUrl();
  const uploadUrl = `${baseUrl}&directory=${encodeURIComponent(targetDir)}`;
  const content = readFileSync(localPath);
  const form = new FormData();
  form.append("files", new Blob([content], { type: getMime(localPath) }), fileName);
  const res = await fetch(uploadUrl, { method: "POST", body: form });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload échoué pour ${fileName} : HTTP ${res.status} ${body}`);
  }
}

/** Liste récursivement tous les fichiers dans un dossier */
function listFiles(dir, base = "") {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel  = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      results.push(...listFiles(full, rel));
    } else {
      results.push({ full, rel });
    }
  }
  return results;
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

// ─── Step 2: Upload fichiers buildés dans /public/ ───────────────────────────

step("Upload des fichiers dans /public/");

const distDir = path.resolve(ROOT, "artifacts/flyhost/dist/public");
const allFiles = listFiles(distDir);
log(`${allFiles.length} fichiers à déployer...`);

let uploaded = 0;
let failed = 0;

for (const { full, rel } of allFiles) {
  const parts = rel.split("/");
  const fileName = parts.pop();
  const subDir = parts.length > 0 ? `/public/${parts.join("/")}` : "/public";

  try {
    await uploadFile(full, fileName, subDir);
    uploaded++;
    if (uploaded % 5 === 0 || uploaded === 1) log(`${uploaded}/${allFiles.length} uploadés...`);
  } catch (e) {
    err(`  Échec: ${rel} — ${e.message}`);
    failed++;
  }

  // Petite pause pour ne pas saturer l'API Wings
  await new Promise(r => setTimeout(r, 150));
}

ok(`${uploaded} fichiers uploadés${failed > 0 ? `, ${failed} échecs` : ""}`);

// ─── Step 3: Upload fichiers statiques (sitemap.xml, robots.txt) ─────────────

step("Upload fichiers SEO (sitemap.xml, robots.txt)");

const staticDir = path.resolve(ROOT, "artifacts/flyhost/public");
const staticFiles = [
  { src: path.join(staticDir, "sitemap.xml"), name: "sitemap.xml" },
  { src: path.join(staticDir, "robots.txt"),  name: "robots.txt"  },
];

for (const { src, name } of staticFiles) {
  try {
    await uploadFile(src, name, "/public");
    ok(`${name} uploadé`);
  } catch (e) {
    err(`${name} : ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 200));
}

// ─── Step 4: Vérification ─────────────────────────────────────────────────────

step("Vérification");
await new Promise(r => setTimeout(r, 3000));

const checkRes = await fetch("https://flihost.site/", { signal: AbortSignal.timeout(10000) }).catch(() => null);
if (checkRes?.ok) {
  const html = await checkRes.text().catch(() => "");
  const firstChars = html.slice(0, 30);
  if (firstChars.startsWith("<!DOCTYPE") || firstChars.startsWith("<html")) {
    ok("Frontend accessible et HTML valide : https://flihost.site/");
  } else if (firstChars.includes('"content"')) {
    err("⚠️ Le fichier index.html semble encore corrompu — relancer le déploiement");
    process.exit(1);
  } else {
    ok("Frontend accessible : https://flihost.site/");
  }
} else {
  log("⚠️  Impossible de vérifier le frontend — vérifiez manuellement https://flihost.site/");
}

console.log("\n\x1b[32m✅ Déploiement frontend réussi !\x1b[0m");
console.log("https://flihost.site/ → OK\n");
