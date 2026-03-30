#!/usr/bin/env node
/**
 * deploy-vps.mjs — Déploie l'API FlyHost sur le container Pterodactyl
 *
 * Usage:
 *   node artifacts/api-server/deploy-vps.mjs
 *   ou via npm script :
 *   pnpm --filter @workspace/api-server run deploy
 *
 * Ce script :
 *   1. Build l'API (esbuild → dist/)
 *   2. Crée un .env avec les variables d'environnement actuelles
 *   3. Zippe le tout (dist/ + .env + package.json)
 *   4. Uploade vers le container Pterodactyl "flyhost-api" (dfc2746a)
 *   5. Décompresse et redémarre le container
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const PTERODACTYL_URL    = process.env.PTERODACTYL_URL;
const PTERODACTYL_CLIENT_KEY = process.env.PTERODACTYL_CLIENT_KEY;
const SERVER_ID          = "dfc2746a"; // Container flyhost-api

const REQUIRED_ENV = [
  "PTERODACTYL_URL",
  "PTERODACTYL_CLIENT_KEY",
  "DATABASE_URL",
  "SESSION_SECRET",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg)  { console.log(`\x1b[36m[deploy]\x1b[0m ${msg}`); }
function ok(msg)   { console.log(`\x1b[32m[✓]\x1b[0m ${msg}`); }
function err(msg)  { console.error(`\x1b[31m[✗]\x1b[0m ${msg}`); }
function step(msg) { console.log(`\n\x1b[1m\x1b[33m▸ ${msg}\x1b[0m`); }

async function pterodactylFetch(path, opts = {}) {
  const url = `${PTERODACTYL_URL}/api/client/servers/${SERVER_ID}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${PTERODACTYL_CLIENT_KEY}`,
      "Accept": "application/json",
      ...(opts.headers || {}),
    },
  });
  return res;
}

// ─── Validation ───────────────────────────────────────────────────────────────

step("Vérification des variables d'environnement");
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  err(`Variables manquantes : ${missing.join(", ")}`);
  process.exit(1);
}
ok("Variables d'environnement OK");

// ─── Step 1: Build ────────────────────────────────────────────────────────────

step("Build de l'API (esbuild)");
try {
  execSync("pnpm --filter @workspace/api-server run build", {
    cwd: ROOT,
    stdio: "inherit",
  });
  ok("Build terminé");
} catch (e) {
  err("Échec du build");
  process.exit(1);
}

// ─── Step 2: Préparer le répertoire de déploiement ───────────────────────────

step("Préparation du package de déploiement");

const deployDir = path.join(tmpdir(), `flyhost-api-deploy-${Date.now()}`);
const zipPath   = deployDir + ".zip";
mkdirSync(deployDir, { recursive: true });

// Copier dist/ (sans les source maps pour alléger)
const distSrc = path.join(__dirname, "dist");
const distDst = path.join(deployDir, "dist");
mkdirSync(distDst, { recursive: true });

function copyDir(src, dst) {
  const { readdirSync } = require("fs");
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      copyDir(path.join(src, entry.name), path.join(dst, entry.name));
    } else if (!entry.name.endsWith(".map")) {
      const srcFile = readFileSync(path.join(src, entry.name));
      writeFileSync(path.join(dst, entry.name), srcFile);
    }
  }
}
copyDir(distSrc, distDst);

// Créer package.json minimal pour npm install dans le container
const pkg = {
  name: "flyhost-api",
  version: "1.0.0",
  type: "module",
  scripts: { start: "node --env-file=.env dist/index.mjs" },
  dependencies: {
    bcryptjs: "^3.0.3",
    nodemailer: "^8.0.4",
  },
};
writeFileSync(path.join(deployDir, "package.json"), JSON.stringify(pkg, null, 2));

// Créer .env avec toutes les variables d'environnement
const envVars = [
  ["PORT",                      "3009"],
  ["NODE_ENV",                  "production"],
  ["APP_URL",                   "https://flihost.site"],
  ["SESSION_SECRET",            process.env.SESSION_SECRET         || ""],
  ["DATABASE_URL",              process.env.DATABASE_URL           || ""],
  ["PTERODACTYL_URL",           process.env.PTERODACTYL_URL        || ""],
  ["PTERODACTYL_APPLICATION_KEY", process.env.PTERODACTYL_APPLICATION_KEY || ""],
  ["PTERODACTYL_CLIENT_KEY",    process.env.PTERODACTYL_CLIENT_KEY || ""],
  ["SERVER_IP",                 process.env.SERVER_IP              || ""],
  ["CF_TOKEN",                  process.env.CF_TOKEN               || ""],
  ["CF_ZONE_ID",                process.env.CF_ZONE_ID             || ""],
  ["SMTP_HOST",                 process.env.SMTP_HOST              || ""],
  ["SMTP_PORT",                 process.env.SMTP_PORT              || ""],
  ["SMTP_USER",                 process.env.SMTP_USER              || ""],
  ["SMTP_PASS",                 process.env.SMTP_PASS              || ""],
  ["SMTP_FROM",                 process.env.SMTP_FROM              || ""],
  ["MF_RELAY_SECRET",           process.env.MF_RELAY_SECRET        || "flyhost-mf-relay-2026-secret"],
  ["MF_RELAY_URL",              "https://flihost.site/api/payment/mf-relay"],
  ["MONEYFUSION_PAY_URL",       "https://www.pay.moneyfusion.net/FLYHOST/8a106a9cd82c8779/pay/"],
  ["LOG_LEVEL",                 "info"],
];

const envContent = envVars.map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
writeFileSync(path.join(deployDir, ".env"), envContent);

ok(`Package préparé dans ${deployDir}`);

// ─── Step 3: Créer le ZIP ─────────────────────────────────────────────────────

step("Création de l'archive ZIP");

// Chercher adm-zip dans pnpm store
let AdmZip;
try {
  const admZipPaths = [
    path.join(ROOT, "node_modules/.pnpm/adm-zip@0.5.16/node_modules/adm-zip"),
    path.join(__dirname, "node_modules/adm-zip"),
    path.join(ROOT, "node_modules/adm-zip"),
  ];
  for (const p of admZipPaths) {
    try {
      AdmZip = require(p);
      break;
    } catch {}
  }
} catch {}

if (!AdmZip) {
  err("adm-zip introuvable");
  process.exit(1);
}

const zip = new AdmZip();

function addToZip(dir, zipBase) {
  const { readdirSync } = require("fs");
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const zipPath_ = zipBase ? `${zipBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addToZip(fullPath, zipPath_);
    } else if (!entry.name.endsWith(".map")) {
      zip.addFile(zipPath_, readFileSync(fullPath));
    }
  }
}

addToZip(deployDir, "");
zip.writeZip(zipPath);

const zipSize = statSync(zipPath).size;
ok(`ZIP créé : ${Math.round(zipSize / 1024)}KB → ${zipPath}`);

// Nettoyer le dossier temporaire (garder seulement le zip)
rmSync(deployDir, { recursive: true, force: true });

// ─── Step 4: Uploader sur Pterodactyl ─────────────────────────────────────────

step("Upload vers le container Pterodactyl");

// Obtenir l'URL d'upload signée
const uploadUrlRes = await pterodactylFetch("/files/upload");
if (!uploadUrlRes.ok) {
  err(`Impossible d'obtenir l'URL d'upload : ${uploadUrlRes.status}`);
  process.exit(1);
}
const { attributes: { url: uploadUrl } } = await uploadUrlRes.json();
log(`URL d'upload obtenue`);

// Créer le FormData avec le fichier ZIP
const zipData = readFileSync(zipPath);
const formData = new FormData();
const blob = new Blob([zipData], { type: "application/zip" });
formData.append("files", blob, "api-deploy.zip");

const uploadRes = await fetch(uploadUrl, {
  method: "POST",
  headers: { "X-Requested-With": "XMLHttpRequest" },
  body: formData,
});

if (!uploadRes.ok) {
  err(`Échec de l'upload : ${uploadRes.status} ${await uploadRes.text()}`);
  rmSync(zipPath, { force: true });
  process.exit(1);
}
ok("ZIP uploadé avec succès");

// Nettoyer le zip local
rmSync(zipPath, { force: true });

// ─── Step 5: Décompresser sur le container ────────────────────────────────────

step("Décompression sur le container");

const decompressRes = await pterodactylFetch("/files/decompress", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ root: "/", file: "api-deploy.zip" }),
});

if (decompressRes.status !== 204) {
  err(`Échec de la décompression : ${decompressRes.status}`);
  process.exit(1);
}
ok("Décompression réussie");

// Attendre que la décompression se termine
log("Attente 5s...");
await new Promise(r => setTimeout(r, 5000));

// ─── Step 6: Redémarrer le container ──────────────────────────────────────────

step("Redémarrage du container API");

const restartRes = await pterodactylFetch("/power", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ signal: "restart" }),
});

if (restartRes.status !== 204) {
  err(`Échec du redémarrage : ${restartRes.status}`);
  process.exit(1);
}
ok("Container redémarré");

// ─── Step 7: Vérification ─────────────────────────────────────────────────────

step("Vérification de l'API (attente 25s)");

await new Promise(r => setTimeout(r, 25000));

try {
  const healthRes = await fetch("https://flihost.site/api/healthz", {
    signal: AbortSignal.timeout(10000),
  });
  const body = await healthRes.text();

  if (healthRes.ok) {
    ok(`API répond : ${body}`);
    console.log("\n\x1b[1m\x1b[32m✅ Déploiement réussi !\x1b[0m");
    console.log("\x1b[36mhttps://flihost.site/api/healthz\x1b[0m → OK\n");
  } else {
    err(`L'API répond ${healthRes.status} : ${body}`);
  }
} catch (e) {
  err(`L'API ne répond pas encore : ${e.message}`);
  log("Le container démarre peut-être encore. Attends 30s et teste manuellement :");
  log("  curl https://flihost.site/api/healthz");
}
