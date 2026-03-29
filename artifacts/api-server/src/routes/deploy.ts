/**
 * deploy.ts — Production deployment pipeline for FlyHost
 * Supports: ZIP upload, GitHub/Git clone, templates
 * Features: real-time SSE logs, snapshots, rollback, tech auto-detection
 */
import { Router, type Response } from "express";
import { requireAuth, requireAuthFlexible, type AuthRequest } from "../middlewares/auth";
import { db, deploymentsTable, deploymentLogsTable } from "@workspace/db";
import { eq, lt, and } from "drizzle-orm";
import multer from "multer";
import AdmZip from "adm-zip";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { uploadZipToPterodactyl, sendPowerAction, writeFileContents, purgeServerFiles, updateStartupVariable, getServerStats, updateServerEnvViaAppAPI, getPteroServerByIdentifier, buildNodeStartup, buildPythonStartup } from "../pterodactyl";

// ————————————————————————————————————————————
//  Helper: apply env updates via Application API (bypasses read-only vars),
//  falls back to client API per-variable.
//  Automatically passes STARTUP as the startup command override if present in updates.
// ————————————————————————————————————————————
async function applyEnvUpdates(identifier: string, envUpdates: Record<string, string>): Promise<void> {
  if (Object.keys(envUpdates).length === 0) return;
  // Extract STARTUP command override if set (used as both startup template and env var)
  const startupCmdOverride = envUpdates["STARTUP"];
  try {
    const serverInfo = await getPteroServerByIdentifier(identifier);
    if (serverInfo) {
      await updateServerEnvViaAppAPI(serverInfo.id, envUpdates, startupCmdOverride);
      return;
    }
  } catch {
    // fall through to client API
  }
  for (const [key, value] of Object.entries(envUpdates)) {
    try { await updateStartupVariable(identifier, key, value); } catch { /* ignore */ }
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const execFileAsync = promisify(execFile);
const router: Router = Router();

// ————————————————————————————————————————————
//  Constants
// ————————————————————————————————————————————
const MAX_DEPLOY_SIZE_MB = 200;
const SNAPSHOT_DIR = path.join(process.cwd(), "uploads", "snapshots");
const STUCK_BUILD_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Ensure snapshot dir exists
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

// ————————————————————————————————————————————
//  SSE broadcast system
// ————————————————————————————————————————————
const sseClients = new Map<number, Set<Response>>();

function broadcastLog(deploymentId: number, level: string, message: string) {
  const data = JSON.stringify({ level, message, timestamp: new Date().toISOString() });
  const clients = sseClients.get(deploymentId);
  if (clients) {
    clients.forEach(res => {
      try { res.write(`data: ${data}\n\n`); } catch { /* ignore closed connections */ }
    });
  }
}

async function logDeploy(deploymentId: number, level: "info" | "warn" | "error" | "success", message: string) {
  try {
    await db.insert(deploymentLogsTable).values({
      deploymentId,
      level,
      message,
      timestamp: new Date(),
    });
  } catch { /* non-fatal */ }
  broadcastLog(deploymentId, level, message);
  console.log(`[deploy:${deploymentId}] [${level}] ${message}`);
}

// SSE endpoint for real-time deploy logs
router.get("/servers/:identifier/deploy/sse", requireAuthFlexible, (req: AuthRequest, res) => {
  const deploymentId = parseInt(req.query.deploymentId as string, 10);
  if (!deploymentId) { res.status(400).end(); return; }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  // Send recent logs (last 200 from DB)
  db.select().from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, deploymentId))
    .orderBy(deploymentLogsTable.timestamp)
    .limit(200)
    .then(logs => {
      logs.forEach(log => {
        const data = JSON.stringify({ level: log.level, message: log.message, timestamp: log.timestamp });
        res.write(`data: ${data}\n\n`);
      });
    });

  // Register client
  if (!sseClients.has(deploymentId)) sseClients.set(deploymentId, new Set());
  sseClients.get(deploymentId)!.add(res);

  // Heartbeat every 2s
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 2000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.get(deploymentId)?.delete(res);
  });
});

// ————————————————————————————————————————————
//  Tech auto-detection
// ————————————————————————————————————————————
function detectTech(files: string[]): string {
  const names = files.map(f => path.basename(f).toLowerCase());
  // Explicit manifest files take priority
  if (names.includes("requirements.txt") || names.includes("pipfile") || names.includes("pyproject.toml")) return "python";
  if (names.includes("composer.json")) return "php";
  if (names.includes("pom.xml") || names.includes("build.gradle") || names.includes("build.gradle.kts")) return "java";
  if (names.includes("cargo.toml")) return "rust";
  if (names.includes("go.mod")) return "go";
  if (names.includes("package.json")) return "nodejs";
  if (files.some(f => f.endsWith(".php"))) return "php";
  if (files.some(f => f.endsWith(".py"))) return "python";
  if (files.some(f => f.endsWith(".java"))) return "java";
  if (names.includes("index.html") || names.includes("index.htm")) return "static";
  return "nodejs";
}

// ————————————————————————————————————————————
//  flyhost.json sanitizer
// ————————————————————————————————————————————
const SAFE_CMD = /^[a-zA-Z0-9 \-_./:=@'"]+$/;
const ALLOWED_FLYHOST_KEYS = new Set(["start", "install", "build", "port", "name", "env"]);

function sanitizeFlyhost(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_FLYHOST_KEYS.has(k)) continue;
    if (typeof v !== "string") continue;
    if (!SAFE_CMD.test(v)) {
      console.warn(`[security] flyhost.json key '${k}' failed safe-cmd check, ignoring`);
      continue;
    }
    out[k] = v;
  }
  return out;
}

// ————————————————————————————————————————————
//  ZIP utilities
// ————————————————————————————————————————————
function buildZipFromDir(srcDir: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("data", c => chunks.push(c as Buffer));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}

async function extractZip(zipPath: string, destDir: string): Promise<string[]> {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
  // Collect all relative paths
  return zip.getEntries().map(e => e.entryName);
}

/** Flatten if all entries share a single root folder (but only if root is clearly a wrapper) */
function flattenIfNeeded(dir: string): string {
  const entries = fs.readdirSync(dir);
  if (entries.length !== 1) return dir;
  const single = path.join(dir, entries[0]);
  const stat = fs.statSync(single);
  if (!stat.isDirectory()) return dir;
  const inner = entries[0].toLowerCase();
  // Don't flatten src/ app/ lib/ etc — only flatten obvious project wrapper folders
  const STRUCTURAL_DIRS = new Set(["src", "app", "lib", "public", "static", "dist", "build", "assets", "components"]);
  if (STRUCTURAL_DIRS.has(inner)) return dir;
  return single;
}

function checkSize(dir: string): void {
  let totalBytes = 0;
  function walk(d: string) {
    for (const e of fs.readdirSync(d)) {
      const full = path.join(d, e);
      const st = fs.statSync(full);
      if (st.isDirectory()) { walk(full); } else { totalBytes += st.size; }
    }
  }
  walk(dir);
  if (totalBytes > MAX_DEPLOY_SIZE_MB * 1024 * 1024) {
    throw new Error(`Projet trop volumineux : ${Math.round(totalBytes / 1024 / 1024)} Mo > ${MAX_DEPLOY_SIZE_MB} Mo max`);
  }
}

function cleanExtracted(dir: string): void {
  const REMOVE_DIRS = ["node_modules", ".git", "__pycache__", ".mypy_cache", "vendor", ".next", "dist", "build"];
  const REMOVE_FILES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Pipfile.lock"];
  function walk(d: string) {
    for (const e of fs.readdirSync(d)) {
      const full = path.join(d, e);
      const st = fs.statSync(full);
      if (st.isDirectory()) {
        if (REMOVE_DIRS.includes(e)) { fs.rmSync(full, { recursive: true, force: true }); continue; }
        walk(full);
      } else if (REMOVE_FILES.includes(e)) {
        fs.rmSync(full, { force: true });
      }
    }
  }
  walk(dir);
}

// ————————————————————————————————————————————
//  Core deploy pipeline
// ————————————————————————————————————————————
async function runDeploy(
  deploymentId: number,
  identifier: string,
  srcDir: string,
  opts: { envVars?: Record<string, string>; startCommand?: string }
): Promise<void> {
  const start = Date.now();

  try {
    const allFiles = getAllFiles(srcDir);

    // Detect tech
    const relFiles = allFiles.map(f => path.relative(srcDir, f));
    const tech = detectTech(relFiles);
    await logDeploy(deploymentId, "info", `Technologie détectée : ${tech}`);

    // Smart project analysis (detects entry point, framework, env vars)
    const analysis = analyzeProject(srcDir, tech, relFiles);
    await logDeploy(deploymentId, "info", `Analyse du projet (confiance: ${analysis.confidence}) :`);
    for (const fix of analysis.fixes) {
      await logDeploy(deploymentId, "info", `  → ${fix}`);
    }

    // Parse flyhost.json if present (overrides analysis)
    const flyhostPath = path.join(srcDir, "flyhost.json");
    let flyhostConfig: Record<string, string> = {};
    if (fs.existsSync(flyhostPath)) {
      try {
        flyhostConfig = sanitizeFlyhost(JSON.parse(fs.readFileSync(flyhostPath, "utf8")));
        await logDeploy(deploymentId, "info", `flyhost.json trouvé et validé`);
      } catch {
        await logDeploy(deploymentId, "warn", `flyhost.json invalide — ignoré`);
      }
    }

    // Clean up heavy dirs
    cleanExtracted(srcDir);
    await logDeploy(deploymentId, "info", `Nettoyage des fichiers inutiles (node_modules, .git, etc.)`);

    // Check size
    checkSize(srcDir);
    await logDeploy(deploymentId, "info", `Taille du projet validée (< ${MAX_DEPLOY_SIZE_MB} Mo)`);

    // Write .env
    const envVars = opts.envVars || {};
    if (Object.keys(envVars).length > 0) {
      const envContent = Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join("\n");
      fs.writeFileSync(path.join(srcDir, ".env"), envContent + "\n");
      await logDeploy(deploymentId, "info", `Fichier .env créé (${Object.keys(envVars).length} variables)`);
    }

    // Write .flyhost.json meta
    fs.writeFileSync(path.join(srcDir, ".flyhost.json"), JSON.stringify({
      deploymentId,
      tech,
      deployedAt: new Date().toISOString(),
      platform: "flyhost",
    }, null, 2));

    // Create snapshot ZIP (before uploading — use cleaned source)
    await logDeploy(deploymentId, "info", `Création du snapshot de rollback...`);
    const snapshotBuffer = await buildZipFromDir(srcDir);
    const snapshotPath = path.join(SNAPSHOT_DIR, `deploy-${deploymentId}.zip`);
    fs.writeFileSync(snapshotPath, snapshotBuffer);
    await db.update(deploymentsTable).set({ snapshotPath }).where(eq(deploymentsTable.id, deploymentId));
    await logDeploy(deploymentId, "info", `Snapshot sauvegardé (${Math.round(snapshotBuffer.length / 1024)} Ko)`);

    // Build deploy ZIP
    await logDeploy(deploymentId, "info", `Construction du ZIP de déploiement...`);
    const deployZip = await buildZipFromDir(srcDir);
    await logDeploy(deploymentId, "info", `ZIP créé : ${Math.round(deployZip.length / 1024)} Ko`);

    // Stop server before upload — use kill for immediate stop to avoid state race conditions
    await logDeploy(deploymentId, "info", `Arrêt du serveur avant déploiement...`);
    try {
      await sendPowerAction(identifier, "kill");
      await sleep(5000); // Wait longer so Wings fully registers the container as offline
    } catch {
      try {
        await sendPowerAction(identifier, "stop");
        await sleep(8000);
      } catch { /* already stopped — continue */ }
    }

    // Purge ALL existing server files so new deploy is a clean slate
    await logDeploy(deploymentId, "info", `Suppression des anciens fichiers du serveur...`);
    const purgeResult = await purgeServerFiles(identifier);
    if (purgeResult.deleted > 0) {
      await logDeploy(deploymentId, "info", `${purgeResult.deleted} fichier(s) supprimé(s)`);
    } else {
      await logDeploy(deploymentId, "info", `Répertoire vide — aucun fichier à supprimer`);
    }

    // Upload to Pterodactyl (panel proxy primary, Wings URL fallback)
    await logDeploy(deploymentId, "info", `Envoi des fichiers vers Pterodactyl...`);
    try {
      await uploadZipToPterodactyl(identifier, deployZip);
    } catch (uploadErr: any) {
      const errMsg: string = uploadErr.message || String(uploadErr);
      // Friendly message for Wings infrastructure issues
      if (errMsg.includes("communicating with the machine") || errMsg.includes("500")) {
        throw new Error(
          `Wings ne peut pas accéder au container du serveur (code 500). ` +
          `Ce serveur semble avoir un problème d'infrastructure. ` +
          `Essayez de le réinstaller depuis le panel Pterodactyl, puis relancez le déploiement.`
        );
      }
      throw uploadErr;
    }
    await logDeploy(deploymentId, "info", `Fichiers déployés sur le serveur`);

    // Apply Pterodactyl environment variables from analysis (before start)
    // Uses Application API to bypass read-only restrictions on client API
    await logDeploy(deploymentId, "info", `Configuration des variables de démarrage...`);
    if (Object.keys(analysis.pteroEnvUpdates).length > 0) {
      try {
        await applyEnvUpdates(identifier, analysis.pteroEnvUpdates);
        for (const [key, value] of Object.entries(analysis.pteroEnvUpdates)) {
          await logDeploy(deploymentId, "info", `  ⚙️  ${key} = ${value}`);
        }
      } catch (envErr: any) {
        await logDeploy(deploymentId, "warn", `  Variables de démarrage non configurées: ${envErr.message}`);
      }
    }

    // Determine final start command (flyhost.json / opts override analysis)
    const startCmd = opts.startCommand || flyhostConfig.start || analysis.startCommand || getDefaultStart(tech);
    if (startCmd) {
      await writeFileContents(identifier, "/.flyhost-start", startCmd);
    }

    // ── First attempt to start ──────────────────────────────────────────
    await logDeploy(deploymentId, "info", `Démarrage du serveur...`);
    try {
      await sendPowerAction(identifier, "start");
    } catch {
      await sleep(2000);
      try { await sendPowerAction(identifier, "start"); } catch { /* ignore */ }
    }

    // ── Crash detection: wait 18s and check state ───────────────────────
    await logDeploy(deploymentId, "info", `Vérification du démarrage (18s)...`);
    const isAlive = await checkServerAlive(identifier, 18000);

    if (!isAlive) {
      await logDeploy(deploymentId, "warn", `⚠️  Le serveur s'est arrêté immédiatement — tentative de correction automatique...`);

      // Build fallback: try alternative entry points for Node/Python
      let retried = false;
      if (tech === "nodejs") {
        // Fallback candidates not already tried
        const tried = analysis.pteroEnvUpdates["MAIN_FILE"] || "index.js";
        const FALLBACK_MAIN = ["index.js", "app.js", "server.js", "main.js", "src/index.js"]
          .filter(c => c !== tried && fs.existsSync(path.join(srcDir, c)));
        if (FALLBACK_MAIN.length > 0) {
          const alt = FALLBACK_MAIN[0];
          await logDeploy(deploymentId, "info", `Correction : MAIN_FILE → ${alt}`);
          try { await applyEnvUpdates(identifier, { MAIN_FILE: alt, NODE_ARGS: "" }); } catch {}
          await sleep(1000);
          try { await sendPowerAction(identifier, "start"); } catch {}
          const alive2 = await checkServerAlive(identifier, 15000);
          if (alive2) {
            await logDeploy(deploymentId, "success", `Serveur démarré après correction automatique (MAIN_FILE=${alt})`);
            retried = true;
          } else {
            await logDeploy(deploymentId, "warn", `Entrée alternative ${alt} n'a pas fonctionné non plus`);
          }
        }
      } else if (tech === "python") {
        const tried = analysis.pteroEnvUpdates["PY_FILE"] || "main.py";
        const FALLBACK_PY = ["main.py", "app.py", "run.py", "server.py", "bot.py"]
          .filter(c => c !== tried && fs.existsSync(path.join(srcDir, c)));
        if (FALLBACK_PY.length > 0) {
          const alt = FALLBACK_PY[0];
          await logDeploy(deploymentId, "info", `Correction : PY_FILE → ${alt}`);
          try { await applyEnvUpdates(identifier, { PY_FILE: alt }); } catch {}
          await sleep(1000);
          try { await sendPowerAction(identifier, "start"); } catch {}
          const alive2 = await checkServerAlive(identifier, 15000);
          if (alive2) {
            await logDeploy(deploymentId, "success", `Serveur démarré après correction automatique (PY_FILE=${alt})`);
            retried = true;
          } else {
            await logDeploy(deploymentId, "warn", `Entrée alternative ${alt} n'a pas fonctionné non plus`);
          }
        }
      }

      if (!retried) {
        // Log actionable suggestions
        await logDeploy(deploymentId, "warn", `Suggestions de correction :`);
        if (tech === "nodejs") {
          await logDeploy(deploymentId, "warn", `  • Ajoutez un fichier flyhost.json avec { "start": "node votre-fichier.js" }`);
          await logDeploy(deploymentId, "warn", `  • Vérifiez que votre point d'entrée (${analysis.pteroEnvUpdates["MAIN_FILE"] || "index.js"}) existe et démarre sans erreur`);
        } else if (tech === "python") {
          await logDeploy(deploymentId, "warn", `  • Ajoutez un fichier flyhost.json avec { "start": "python votre-script.py" }`);
          await logDeploy(deploymentId, "warn", `  • Vérifiez que requirements.txt liste toutes vos dépendances`);
        } else {
          await logDeploy(deploymentId, "warn", `  • Consultez la console du serveur pour voir le message d'erreur`);
        }
        // Still mark as deployed (server may need manual start with correct config)
        await logDeploy(deploymentId, "info", `Fichiers déployés — vérifiez la console du serveur pour diagnostiquer`);
      }
    } else {
      await logDeploy(deploymentId, "success", `Serveur opérationnel ✓`);
    }

    const duration = Math.round((Date.now() - start) / 1000);
    await logDeploy(deploymentId, "success", `Déploiement terminé en ${duration}s !`);

    await db.update(deploymentsTable).set({
      status: "deployed",
      duration,
      updatedAt: new Date(),
    }).where(eq(deploymentsTable.id, deploymentId));

    // Broadcast completion
    broadcastLog(deploymentId, "done", "__DEPLOY_COMPLETE__");

  } catch (err: any) {
    const msg = err?.message || "Erreur inconnue";
    await logDeploy(deploymentId, "error", `Déploiement échoué : ${msg}`);
    await db.update(deploymentsTable).set({ status: "failed", updatedAt: new Date() }).where(eq(deploymentsTable.id, deploymentId));
    broadcastLog(deploymentId, "error", "__DEPLOY_FAILED__");
  }
}

function getAllFiles(dir: string, base = dir): string[] {
  const result: string[] = [];
  for (const e of fs.readdirSync(dir)) {
    const full = path.join(dir, e);
    if (fs.statSync(full).isDirectory()) result.push(...getAllFiles(full, base));
    else result.push(full);
  }
  return result;
}

function getDefaultStart(tech: string): string {
  const map: Record<string, string> = {
    nodejs: "node index.js",
    python: "python main.py",
    php: "php -S 0.0.0.0:${SERVER_PORT:-3000}",
    java: "java -jar app.jar",
    static: "npx serve . -p ${SERVER_PORT:-3000}",
  };
  return map[tech] || "";
}

// ————————————————————————————————————————————
//  Smart project analysis & auto-fix
// ————————————————————————————————————————————
export interface ProjectAnalysis {
  startCommand: string;
  /** Pterodactyl egg env vars to update before launch */
  pteroEnvUpdates: Record<string, string>;
  /** Human-readable list of what was auto-detected / fixed */
  fixes: string[];
  confidence: "high" | "medium" | "low";
}

function analyzeNodeProject(srcDir: string): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  let pkg: Record<string, any> = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(srcDir, "package.json"), "utf8")); } catch {}

  // 1 — explicit main field
  let mainFile = "";
  let confidence: "high" | "medium" | "low" = "medium";

  if (pkg.main) {
    mainFile = pkg.main;
    fixes.push(`"main" dans package.json → ${mainFile}`);
    confidence = "high";
  }

  // 2 — scripts.start
  if (!mainFile && pkg.scripts?.start) {
    const s: string = pkg.scripts.start;
    const m = s.match(/(?:node|ts-node|tsx|bun)\s+(?:--[^\s]+\s+)*([^\s]+\.(?:js|ts|mjs|cjs))/);
    if (m) {
      mainFile = m[1];
      fixes.push(`scripts.start: "${s}" → entrée: ${mainFile}`);
      confidence = "high";
    }
  }

  // 3 — scan common filenames
  if (!mainFile) {
    const CANDIDATES = [
      "index.js", "app.js", "server.js", "main.js",
      "src/index.js", "src/app.js", "src/server.js",
      "index.ts", "app.ts", "server.ts", "main.ts",
      "src/index.ts", "src/app.ts",
    ];
    for (const c of CANDIDATES) {
      if (fs.existsSync(path.join(srcDir, c))) {
        mainFile = c;
        fixes.push(`Point d'entrée auto-détecté : ${c}`);
        confidence = c.startsWith("src/") ? "medium" : "high";
        break;
      }
    }
  }

  if (!mainFile) {
    mainFile = "index.js";
    confidence = "low";
    fixes.push(`Aucun point d'entrée trouvé — défaut: index.js`);
  }

  pteroEnvUpdates["MAIN_FILE"] = mainFile;
  pteroEnvUpdates["USER_UPLOAD"] = "1";
  pteroEnvUpdates["NODE_ARGS"] = "";   // Clear any invalid flags (e.g. pm2 flags)

  // Build the STARTUP env var — this egg uses STARTUP as the full startup command
  const nodeStartupCmd = buildNodeStartup(mainFile);
  pteroEnvUpdates["STARTUP"] = nodeStartupCmd;
  fixes.push(`STARTUP configuré → node "/home/container/${mainFile}"`);

  // TypeScript ?
  const isTs = mainFile.endsWith(".ts");
  if (isTs) fixes.push(`TypeScript détecté → ts-node sera utilisé`);

  // package.json → npm install auto
  if (fs.existsSync(path.join(srcDir, "package.json")))
    fixes.push(`package.json présent → npm install exécuté automatiquement`);

  return {
    startCommand: isTs ? `ts-node ${mainFile}` : `node ${mainFile}`,
    pteroEnvUpdates,
    fixes,
    confidence,
  };
}

function analyzePythonProject(srcDir: string): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  let requirements = "";
  try { requirements = fs.readFileSync(path.join(srcDir, "requirements.txt"), "utf8").toLowerCase(); } catch {}

  const isFlask    = requirements.includes("flask");
  const isDjango   = requirements.includes("django");
  const isFastAPI  = requirements.includes("fastapi");
  const isUvicorn  = requirements.includes("uvicorn");
  const isGunicorn = requirements.includes("gunicorn");

  // Find entry file
  const PY_CANDIDATES = ["main.py", "app.py", "run.py", "server.py", "bot.py", "index.py", "manage.py"];
  let entryFile = PY_CANDIDATES.find(c => fs.existsSync(path.join(srcDir, c))) || "";

  // Django
  if (isDjango && fs.existsSync(path.join(srcDir, "manage.py"))) {
    fixes.push(`Django détecté → manage.py runserver`);
    pteroEnvUpdates["PY_FILE"] = "manage.py";
    pteroEnvUpdates["REQUIREMENTS_FILE"] = "requirements.txt";
    return {
      startCommand: "python manage.py runserver 0.0.0.0:${SERVER_PORT:-3000}",
      pteroEnvUpdates, fixes, confidence: "high",
    };
  }

  // FastAPI / uvicorn
  if (isFastAPI || isUvicorn) {
    const module = entryFile ? path.basename(entryFile, ".py") : "main";
    let appVar = "app";
    if (entryFile) {
      try {
        const src = fs.readFileSync(path.join(srcDir, entryFile), "utf8");
        const m = src.match(/^(\w+)\s*=\s*FastAPI\(/m);
        if (m) appVar = m[1];
      } catch {}
    }
    fixes.push(`FastAPI + Uvicorn → uvicorn ${module}:${appVar} --host 0.0.0.0`);
    pteroEnvUpdates["PY_FILE"] = entryFile || "main.py";
    pteroEnvUpdates["REQUIREMENTS_FILE"] = "requirements.txt";
    return {
      startCommand: `uvicorn ${module}:${appVar} --host 0.0.0.0 --port \${SERVER_PORT:-3000}`,
      pteroEnvUpdates, fixes, confidence: "high",
    };
  }

  // Flask
  if (isFlask) {
    const module = entryFile ? path.basename(entryFile, ".py") : "app";
    fixes.push(`Flask détecté → ${isGunicorn ? "gunicorn" : "python"} ${entryFile || "app.py"}`);
    pteroEnvUpdates["PY_FILE"] = entryFile || "app.py";
    pteroEnvUpdates["REQUIREMENTS_FILE"] = "requirements.txt";
    return {
      startCommand: isGunicorn
        ? `gunicorn ${module}:app --bind 0.0.0.0:\${SERVER_PORT:-3000}`
        : `python ${entryFile || "app.py"}`,
      pteroEnvUpdates, fixes, confidence: "high",
    };
  }

  // Generic
  if (!entryFile) {
    entryFile = "main.py";
    fixes.push(`Aucun point d'entrée trouvé — défaut: main.py`);
  } else {
    fixes.push(`Point d'entrée auto-détecté : ${entryFile}`);
  }
  pteroEnvUpdates["PY_FILE"] = entryFile;
  pteroEnvUpdates["REQUIREMENTS_FILE"] = "requirements.txt";

  return {
    startCommand: `python ${entryFile}`,
    pteroEnvUpdates, fixes, confidence: entryFile === "main.py" ? "low" : "high",
  };
}

function analyzePhpProject(srcDir: string): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  let docRoot = ".";
  let confidence: "high" | "medium" | "low" = "medium";

  if (fs.existsSync(path.join(srcDir, "public", "index.php"))) {
    docRoot = "public";
    fixes.push(`Document root: public/ (Laravel / Symfony)`);
    confidence = "high";
  } else if (fs.existsSync(path.join(srcDir, "www", "index.php"))) {
    docRoot = "www";
    fixes.push(`Document root: www/`);
    confidence = "high";
  } else if (fs.existsSync(path.join(srcDir, "index.php"))) {
    docRoot = ".";
    fixes.push(`Document root: racine du projet`);
    confidence = "high";
  } else {
    fixes.push(`Aucun index.php trouvé — défaut: racine`);
    confidence = "low";
  }

  if (fs.existsSync(path.join(srcDir, "composer.json")))
    fixes.push(`composer.json présent → composer install exécuté automatiquement`);

  pteroEnvUpdates["DOCUMENT_ROOT"] = docRoot;

  return {
    startCommand: `php -S 0.0.0.0:\${SERVER_PORT:-3000} -t /home/container/${docRoot}`,
    pteroEnvUpdates, fixes, confidence,
  };
}

function analyzeJavaProject(srcDir: string, files: string[]): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  const jars = files.filter(f => f.toLowerCase().endsWith(".jar") && !f.includes("node_modules"));
  let jarFile = "app.jar";
  let confidence: "high" | "medium" | "low" = "low";

  if (jars.length === 1) {
    jarFile = path.basename(jars[0]);
    fixes.push(`JAR auto-détecté : ${jarFile}`);
    confidence = "high";
  } else if (jars.length > 1) {
    const main = jars.find(j => !/(sources|javadoc|test)/.test(path.basename(j)));
    if (main) {
      jarFile = path.basename(main);
      fixes.push(`JAR principal parmi ${jars.length} archives: ${jarFile}`);
      confidence = "high";
    }
  } else {
    fixes.push(`Aucun JAR trouvé — défaut: app.jar`);
  }

  pteroEnvUpdates["JARFILE"] = jarFile;

  return {
    startCommand: `java -jar ${jarFile}`,
    pteroEnvUpdates, fixes, confidence,
  };
}

export function analyzeProject(srcDir: string, tech: string, files: string[]): ProjectAnalysis {
  switch (tech) {
    case "nodejs": return analyzeNodeProject(srcDir);
    case "python": return analyzePythonProject(srcDir);
    case "php":    return analyzePhpProject(srcDir);
    case "java":   return analyzeJavaProject(srcDir, files);
    default: return { startCommand: getDefaultStart(tech), pteroEnvUpdates: {}, fixes: [], confidence: "low" };
  }
}

async function applyAnalysis(
  deploymentId: number,
  identifier: string,
  analysis: ProjectAnalysis
): Promise<void> {
  if (analysis.fixes.length === 0) return;
  await logDeploy(deploymentId, "info", `Analyse du projet :`);
  for (const fix of analysis.fixes) {
    await logDeploy(deploymentId, "info", `  → ${fix}`);
  }
  if (Object.keys(analysis.pteroEnvUpdates).length > 0) {
    try {
      await applyEnvUpdates(identifier, analysis.pteroEnvUpdates);
      for (const [key, value] of Object.entries(analysis.pteroEnvUpdates)) {
        await logDeploy(deploymentId, "info", `⚙️  ${key} = ${value}`);
      }
    } catch (e: any) {
      await logDeploy(deploymentId, "warn", `Variables de démarrage non configurées: ${e.message}`);
    }
  }
}

async function checkServerAlive(identifier: string, waitMs = 18000): Promise<boolean> {
  await sleep(waitMs);
  try {
    const res = await getServerStats(identifier);
    const state: string = res?.attributes?.current_state || "";
    return state === "running";
  } catch {
    return false;
  }
}

// ————————————————————————————————————————————
//  Route: POST /api/deploy/zip
// ————————————————————————————————————————————
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_DEPLOY_SIZE_MB * 1024 * 1024 },
});

router.post("/deploy/zip", requireAuth, upload.single("file"), async (req: AuthRequest, res): Promise<void> => {
  const zipFile = req.file;
  const { identifier, envVars: envVarsRaw } = req.body;

  if (!zipFile) { res.status(400).json({ error: "Fichier ZIP requis" }); return; }
  if (!identifier) { res.status(400).json({ error: "Identifiant de serveur requis" }); return; }

  let envVars: Record<string, string> = {};
  try { envVars = envVarsRaw ? JSON.parse(envVarsRaw) : {}; } catch { /* ignore */ }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flyhost-"));

  try {
    // Create deployment record
    const [deployment] = await db.insert(deploymentsTable).values({
      userId: req.userId!,
      status: "building",
      method: "zip",
      serverId: identifier,
      updatedAt: new Date(),
    }).returning();

    // Return immediately with deploymentId
    res.status(202).json({ deploymentId: deployment.id, identifier });

    // Extract ZIP
    const allPaths = await extractZip(zipFile.path, tmpDir);
    const srcDir = flattenIfNeeded(tmpDir);

    // Run deploy pipeline asynchronously
    runDeploy(deployment.id, identifier, srcDir, { envVars }).finally(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(zipFile.path, { force: true });
    });

    await logDeploy(deployment.id, "info", `ZIP reçu : ${Math.round(zipFile.size / 1024)} Ko, ${allPaths.length} fichiers`);
  } catch (err: any) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(zipFile.path, { force: true });
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ————————————————————————————————————————————
//  Route: POST /api/deploy/github
// ————————————————————————————————————————————
router.post("/deploy/github", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { identifier, gitUrl, branch = "main", envVars = {}, startCommand } = req.body;

  if (!identifier) { res.status(400).json({ error: "Identifiant de serveur requis" }); return; }
  if (!gitUrl || typeof gitUrl !== "string") { res.status(400).json({ error: "URL Git requise" }); return; }

  // Validate git URL to prevent injection
  const safeGitUrl = /^https?:\/\/[a-zA-Z0-9._/:\-@%]+$/.test(gitUrl);
  if (!safeGitUrl) { res.status(400).json({ error: "URL Git invalide" }); return; }
  const safeBranch = /^[a-zA-Z0-9._/-]+$/.test(branch) ? branch : "main";

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "flyhost-git-"));

  try {
    const [deployment] = await db.insert(deploymentsTable).values({
      userId: req.userId!,
      status: "building",
      method: "github",
      serverId: identifier,
      branch: safeBranch,
      updatedAt: new Date(),
    }).returning();

    res.status(202).json({ deploymentId: deployment.id, identifier });

    // Clone in background
    (async () => {
      try {
        await logDeploy(deployment.id, "info", `Clonage du dépôt : ${gitUrl} (branche: ${safeBranch})`);
        await execFileAsync("git", ["clone", "--depth", "1", "--branch", safeBranch, gitUrl, tmpDir], {
          timeout: 120_000,
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        });
        await logDeploy(deployment.id, "info", `Dépôt cloné avec succès`);

        // Get commit info
        try {
          const { stdout: commitHash } = await execFileAsync("git", ["-C", tmpDir, "rev-parse", "HEAD"]);
          const { stdout: commitMsg } = await execFileAsync("git", ["-C", tmpDir, "log", "-1", "--pretty=%s"]);
          await db.update(deploymentsTable).set({
            commit: commitHash.trim().substring(0, 40),
            commitMessage: commitMsg.trim().substring(0, 255),
          }).where(eq(deploymentsTable.id, deployment.id));
          await logDeploy(deployment.id, "info", `Commit : ${commitHash.trim().substring(0, 7)} — ${commitMsg.trim().substring(0, 60)}`);
        } catch { /* non-fatal */ }

        await runDeploy(deployment.id, identifier, tmpDir, { envVars, startCommand });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    })();
  } catch (err: any) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// ————————————————————————————————————————————
//  Route: GET /api/deploy/:id — status
// ————————————————————————————————————————————
router.get("/deploy/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [dep] = await db.select().from(deploymentsTable).where(eq(deploymentsTable.id, id)).limit(1);
  if (!dep || dep.userId !== req.userId) { res.status(404).json({ error: "Déploiement introuvable" }); return; }
  res.json(dep);
});

// ————————————————————————————————————————————
//  Route: GET /api/deploy/:id/logs
// ————————————————————————————————————————————
router.get("/deploy/:id/logs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const logs = await db.select().from(deploymentLogsTable)
    .where(eq(deploymentLogsTable.deploymentId, id))
    .orderBy(deploymentLogsTable.timestamp)
    .limit(500);
  res.json(logs);
});

// ————————————————————————————————————————————
//  Route: POST /api/servers/:identifier/rollback/:deploymentId
// ————————————————————————————————————————————
router.post("/servers/:identifier/rollback/:deploymentId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { identifier, deploymentId } = req.params;
  const depId = parseInt(deploymentId, 10);

  const [dep] = await db.select().from(deploymentsTable)
    .where(and(eq(deploymentsTable.id, depId), eq(deploymentsTable.userId, req.userId!)))
    .limit(1);

  if (!dep) { res.status(404).json({ error: "Déploiement introuvable" }); return; }
  if (!dep.snapshotPath || !fs.existsSync(dep.snapshotPath)) {
    res.status(409).json({ error: "Snapshot de rollback indisponible" }); return;
  }

  try {
    const snapshotZip = fs.readFileSync(dep.snapshotPath);
    // Kill server, purge existing files, then restore snapshot
    try { await sendPowerAction(identifier, "kill"); await sleep(3000); } catch { /* already stopped */ }
    await purgeServerFiles(identifier);
    await uploadZipToPterodactyl(identifier, snapshotZip);
    try { await sendPowerAction(identifier, "restart"); } catch { await sendPowerAction(identifier, "start"); }

    // Create rollback deployment record
    const [rollbackDep] = await db.insert(deploymentsTable).values({
      userId: req.userId!,
      status: "deployed",
      method: "rollback",
      serverId: identifier,
      commitMessage: `Rollback vers déploiement #${depId}`,
      updatedAt: new Date(),
    }).returning();

    res.json({ success: true, deploymentId: rollbackDep.id, message: `Rollback vers déploiement #${depId} réussi` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ————————————————————————————————————————————
//  Cron: detect stuck "building" deployments
// ————————————————————————————————————————————
setInterval(async () => {
  try {
    const stuckBefore = new Date(Date.now() - STUCK_BUILD_TIMEOUT_MS);
    const stuck = await db.update(deploymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(
        eq(deploymentsTable.status, "building"),
        lt(deploymentsTable.updatedAt, stuckBefore)
      ))
      .returning();
    if (stuck.length > 0) {
      console.warn(`[deploy-cron] ${stuck.length} déploiement(s) bloqué(s) marqué(s) comme failed`);
    }
  } catch { /* ignore cron errors */ }
}, 60_000); // Check every minute

export default router;
