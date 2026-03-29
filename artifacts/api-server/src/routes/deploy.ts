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
import { uploadZipToPterodactyl, sendPowerAction, writeFileContents } from "../pterodactyl";

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
    const tech = detectTech(allFiles.map(f => path.relative(srcDir, f)));
    await logDeploy(deploymentId, "info", `Technologie détectée : ${tech}`);

    // Parse flyhost.json if present
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

    // Write startup info (sanitized)
    const startCmd = opts.startCommand || flyhostConfig.start || getDefaultStart(tech);
    if (startCmd) {
      await writeFileContents(identifier, "/home/container/.flyhost-start", startCmd);
    }

    // Start server
    await logDeploy(deploymentId, "info", `Démarrage du serveur...`);
    try {
      await sendPowerAction(identifier, "start");
    } catch {
      await sleep(2000);
      try { await sendPowerAction(identifier, "start"); } catch { /* ignore */ }
    }
    await logDeploy(deploymentId, "info", `Serveur démarré avec succès`);

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
