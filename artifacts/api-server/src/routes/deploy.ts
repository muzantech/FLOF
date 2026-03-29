/**
 * deploy.ts — Production deployment pipeline for FlyHost
 * Supports: ZIP upload, GitHub/Git clone, templates
 * Features: real-time SSE logs, snapshots, rollback, tech auto-detection
 */
import { Router, type Response } from "express";
import { requireAuth, requireAuthFlexible, type AuthRequest } from "../middlewares/auth";
import { db, deploymentsTable, deploymentLogsTable, serverSubdomainsTable } from "@workspace/db";
import { eq, lt, and } from "drizzle-orm";
import multer from "multer";
import AdmZip from "adm-zip";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { uploadZipToPterodactyl, sendPowerAction, writeFileContents, purgeServerFiles, updateStartupVariable, getServerStats, updateServerEnvViaAppAPI, getPteroServerByIdentifier, getPteroServer, buildNodeStartup, buildPythonStartup, buildPhpStartup, buildStaticStartup, buildBunStartup, buildDenoStartup, buildRubyStartup, buildGoStartup, getServerCurrentEgg, switchServerEgg, EGG_CONFIGS } from "../pterodactyl";
import { createSubdomainDNS } from "../cloudflare";
import { setCacheEntry } from "../subdomain-proxy";

// All tech types that get subdomain routing and egg management
const WEB_TECHS = new Set(["nodejs", "bun", "deno", "python", "php", "ruby", "go", "java", "static"]);

// Maps detected tech to the egg key in EGG_CONFIGS
const TECH_TO_EGG: Record<string, string> = {
  nodejs: "nodejs",
  bun: "nodejs",    // Bun runs inside Node.js egg (fallback to node if bun not available)
  deno: "nodejs",   // Deno runs inside Node.js egg (fallback to node if deno not available)
  static: "nodejs", // Static sites served via npx serve (in Node.js egg)
  python: "python",
  php: "php",
  java: "java",
  ruby: "nodejs",   // Ruby falls back to Node.js egg with error if no ruby binary
  go: "nodejs",     // Go falls back to Node.js egg with error if no go binary
};

function generateSubdomain(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 32) || "server";
}

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
//  Universal tech detection (all languages + mixed projects)
// ————————————————————————————————————————————

interface TechScore {
  tech: string;
  score: number;
  signals: string[];
}

/**
 * detectTechFull — scores ALL detected technologies and returns the primary one.
 * Handles mixed projects (e.g. Python backend + Node.js tooling).
 * flyhost.json "runtime" field overrides all detection.
 */
function detectTech(files: string[], srcDir?: string): string {
  return detectTechFull(files, srcDir).primary;
}

function detectTechFull(files: string[], srcDir?: string): { primary: string; all: TechScore[]; isMixed: boolean } {
  const names = new Set(files.map(f => path.basename(f).toLowerCase()));
  const exts = new Set(files.map(f => path.extname(f).toLowerCase()));
  const relPaths = files.map(f => f.toLowerCase().replace(/\\/g, "/"));

  // Helper to check existence of file in extracted dir
  const hasFile = (name: string) => srcDir ? fs.existsSync(path.join(srcDir, name)) : names.has(name);
  const hasPath = (p: string) => relPaths.some(f => f.includes(p));

  // Read package.json for deeper analysis
  let pkgJson: Record<string, any> = {};
  if (srcDir && fs.existsSync(path.join(srcDir, "package.json"))) {
    try { pkgJson = JSON.parse(fs.readFileSync(path.join(srcDir, "package.json"), "utf8")); } catch {}
  }

  const scores: TechScore[] = [];

  // ── Bun ─────────────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("bun.lockb") || names.has("bun.lock")) s.push("bun.lockb trouvé");
    if (names.has("bunfig.toml")) s.push("bunfig.toml trouvé");
    if (pkgJson?.scripts?.start?.includes("bun ")) s.push("scripts.start utilise bun");
    if (pkgJson?.scripts?.dev?.includes("bun ")) s.push("scripts.dev utilise bun");
    if (s.length > 0) scores.push({ tech: "bun", score: s.length * 20, signals: s });
  }

  // ── Deno ─────────────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("deno.json") || names.has("deno.jsonc")) s.push("deno.json trouvé");
    if (names.has("deno.lock")) s.push("deno.lock trouvé");
    if (files.some(f => f.endsWith(".ts") && fs.existsSync && hasPath("import_map"))) s.push("import_map.json");
    if (hasPath("deps.ts") || hasPath("mod.ts")) s.push("deps.ts / mod.ts (convention Deno)");
    if (s.length > 0) scores.push({ tech: "deno", score: s.length * 18, signals: s });
  }

  // ── Node.js ───────────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("package.json")) s.push("package.json trouvé");
    if (names.has("package-lock.json")) s.push("package-lock.json");
    if (names.has("yarn.lock")) s.push("yarn.lock");
    if (names.has("pnpm-lock.yaml")) s.push("pnpm-lock.yaml");
    if (names.has(".nvmrc") || names.has(".node-version")) s.push(".nvmrc / .node-version");
    if (names.has("tsconfig.json")) s.push("tsconfig.json");
    if (names.has("next.config.js") || names.has("next.config.ts")) s.push("next.config → Next.js");
    if (names.has("nuxt.config.ts") || names.has("nuxt.config.js")) s.push("nuxt.config → Nuxt");
    if (names.has("vite.config.ts") || names.has("vite.config.js")) s.push("vite.config");
    if (names.has("remix.config.js")) s.push("remix.config");
    if (names.has("svelte.config.js")) s.push("svelte.config");
    if (exts.has(".js") || exts.has(".ts") || exts.has(".mjs") || exts.has(".cjs")) s.push("fichiers JS/TS");
    // Check scripts
    const startScript = pkgJson?.scripts?.start || "";
    if (startScript.includes("node ") || startScript.includes("ts-node") || startScript.includes("tsx")) s.push("scripts.start Node.js");
    if (s.length > 0) scores.push({ tech: "nodejs", score: s.length * 10, signals: s });
  }

  // ── Python ────────────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("requirements.txt")) s.push("requirements.txt");
    if (names.has("pipfile") || names.has("pipfile.lock")) s.push("Pipfile");
    if (names.has("pyproject.toml")) s.push("pyproject.toml");
    if (names.has("setup.py") || names.has("setup.cfg")) s.push("setup.py / setup.cfg");
    if (names.has("poetry.lock")) s.push("poetry.lock");
    if (names.has("manage.py")) s.push("manage.py (Django)");
    if (names.has("wsgi.py") || hasPath("wsgi.py")) s.push("wsgi.py");
    if (names.has("asgi.py") || hasPath("asgi.py")) s.push("asgi.py");
    if (exts.has(".py")) s.push("fichiers .py");
    // Check requirements content for frameworks
    if (srcDir && fs.existsSync(path.join(srcDir, "requirements.txt"))) {
      const req = fs.readFileSync(path.join(srcDir, "requirements.txt"), "utf8").toLowerCase();
      if (req.includes("flask")) s.push("Flask");
      if (req.includes("django")) s.push("Django");
      if (req.includes("fastapi")) s.push("FastAPI");
      if (req.includes("aiohttp")) s.push("aiohttp");
      if (req.includes("tornado")) s.push("Tornado");
    }
    if (s.length > 0) scores.push({ tech: "python", score: s.length * 12, signals: s });
  }

  // ── PHP ───────────────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("composer.json")) s.push("composer.json");
    if (names.has("composer.lock")) s.push("composer.lock");
    if (exts.has(".php")) s.push("fichiers .php");
    if (hasFile("public/index.php")) s.push("public/index.php (Laravel)");
    if (hasPath("artisan")) s.push("artisan (Laravel)");
    if (hasPath("wp-config.php") || hasPath("wp-login.php")) s.push("WordPress");
    if (hasPath("config/bootstrap.php")) s.push("Symfony");
    if (s.length > 0) scores.push({ tech: "php", score: s.length * 12, signals: s });
  }

  // ── Java ──────────────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("pom.xml")) s.push("pom.xml (Maven)");
    if (names.has("build.gradle") || names.has("build.gradle.kts")) s.push("build.gradle (Gradle)");
    if (names.has("gradlew") || names.has("mvnw")) s.push("wrapper Maven/Gradle");
    if (exts.has(".java")) s.push("fichiers .java");
    if (files.some(f => f.endsWith(".jar") && !f.includes("node_modules"))) s.push("fichier .jar");
    if (hasPath("src/main/java") || hasPath("src/main/kotlin")) s.push("structure Maven standard");
    if (s.length > 0) scores.push({ tech: "java", score: s.length * 15, signals: s });
  }

  // ── Ruby ──────────────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("gemfile") || names.has("Gemfile")) s.push("Gemfile");
    if (names.has("gemfile.lock") || names.has("Gemfile.lock")) s.push("Gemfile.lock");
    if (exts.has(".rb")) s.push("fichiers .rb");
    if (names.has("rakefile") || names.has("Rakefile")) s.push("Rakefile");
    if (names.has("config.ru")) s.push("config.ru (Rack/Sinatra/Rails)");
    if (hasPath("config/application.rb")) s.push("Rails");
    if (s.length > 0) scores.push({ tech: "ruby", score: s.length * 12, signals: s });
  }

  // ── Go ────────────────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("go.mod")) s.push("go.mod");
    if (names.has("go.sum")) s.push("go.sum");
    if (exts.has(".go")) s.push("fichiers .go");
    if (s.length > 0) scores.push({ tech: "go", score: s.length * 15, signals: s });
  }

  // ── Rust (lang, NOT game) ─────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("cargo.toml")) s.push("Cargo.toml");
    if (names.has("cargo.lock")) s.push("Cargo.lock");
    if (exts.has(".rs")) s.push("fichiers .rs");
    if (s.length > 0) scores.push({ tech: "rust-lang", score: s.length * 15, signals: s });
  }

  // ── Static HTML ───────────────────────────────────────────────────
  {
    const s: string[] = [];
    if (names.has("index.html") || names.has("index.htm")) s.push("index.html");
    if (exts.has(".html") || exts.has(".htm")) s.push("fichiers HTML");
    if (names.has("styles.css") || names.has("style.css") || names.has("main.css")) s.push("CSS");
    // Only count as static if no server-side tech found yet
    if (s.length > 0) scores.push({ tech: "static", score: s.length * 5, signals: s });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Determine primary tech
  let primary = scores[0]?.tech || "nodejs";

  // Resolve Rust (lang) — falls back to Node.js egg since no Rust egg
  if (primary === "rust-lang") primary = "rust-lang";

  // Mixed: if top two scores are close, it's a mixed project
  const isMixed = scores.length >= 2 && scores[1].score >= scores[0].score * 0.6;

  // For mixed projects: prefer the more specific server-side tech
  // (e.g., Python beats static; PHP beats static; Node.js beats static)
  if (isMixed) {
    const serverTechs = ["python", "php", "java", "ruby", "go", "rust-lang"];
    const topServer = scores.find(s => serverTechs.includes(s.tech));
    if (topServer) primary = topServer.tech;
  }

  // Bun/Deno take priority over plain nodejs if score is higher
  // (they're already sorted, so this is handled)

  return { primary, all: scores, isMixed };
}

// ————————————————————————————————————————————
//  flyhost.json sanitizer (v2 — supports runtime override)
// ————————————————————————————————————————————
const SAFE_CMD = /^[a-zA-Z0-9 \-_./:=@'"]+$/;
const ALLOWED_FLYHOST_KEYS = new Set(["start", "install", "build", "port", "name", "env", "runtime", "entry"]);
const VALID_RUNTIMES = new Set(["nodejs", "bun", "deno", "python", "php", "java", "ruby", "go", "static"]);

function sanitizeFlyhost(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_FLYHOST_KEYS.has(k)) continue;
    if (typeof v !== "string") continue;
    // Validate runtime enum
    if (k === "runtime" && !VALID_RUNTIMES.has(v)) {
      console.warn(`[security] flyhost.json: runtime '${v}' is not a valid runtime, ignoring`);
      continue;
    }
    if (k !== "runtime" && k !== "entry" && !SAFE_CMD.test(v)) {
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
  opts: { envVars?: Record<string, string>; startCommand?: string; userId?: number | null }
): Promise<void> {
  const start = Date.now();

  try {
    const allFiles = getAllFiles(srcDir);
    const relFiles = allFiles.map(f => path.relative(srcDir, f));

    // ── Parse flyhost.json FIRST (before detection) — supports runtime override ──
    const flyhostPath = path.join(srcDir, "flyhost.json");
    let flyhostConfig: Record<string, string> = {};
    if (fs.existsSync(flyhostPath)) {
      try {
        flyhostConfig = sanitizeFlyhost(JSON.parse(fs.readFileSync(flyhostPath, "utf8")));
        await logDeploy(deploymentId, "info", `flyhost.json trouvé et validé`);
        if (flyhostConfig.runtime) {
          await logDeploy(deploymentId, "info", `  → runtime forcé par flyhost.json: ${flyhostConfig.runtime}`);
        }
        if (flyhostConfig.entry) {
          await logDeploy(deploymentId, "info", `  → point d'entrée forcé: ${flyhostConfig.entry}`);
        }
        if (flyhostConfig.start) {
          await logDeploy(deploymentId, "info", `  → commande de démarrage: ${flyhostConfig.start}`);
        }
      } catch {
        await logDeploy(deploymentId, "warn", `flyhost.json invalide — ignoré`);
      }
    }

    // ── Full tech detection with mixed project support ──
    const techResult = detectTechFull(relFiles, srcDir);
    // flyhost.json runtime field overrides auto-detection
    const tech = flyhostConfig.runtime || techResult.primary;

    if (flyhostConfig.runtime) {
      await logDeploy(deploymentId, "info", `Runtime: ${tech} (défini dans flyhost.json)`);
    } else {
      await logDeploy(deploymentId, "info", `Runtime détecté: ${tech} (confiance: ${techResult.isMixed ? "mixte" : "haute"})`);
      if (techResult.isMixed) {
        await logDeploy(deploymentId, "info", `⚡ Projet mixte — technologies détectées:`);
        for (const t of techResult.all.slice(0, 4)) {
          await logDeploy(deploymentId, "info", `   ${t.tech} (score: ${t.score}) — ${t.signals.join(", ")}`);
        }
      } else if (techResult.all.length > 0) {
        const top = techResult.all[0];
        for (const sig of top.signals) {
          await logDeploy(deploymentId, "info", `  → ${sig}`);
        }
      }
    }

    // ── Smart project analysis (detects entry point, framework, env vars) ──
    const analysis = analyzeProject(srcDir, tech, relFiles);
    // Override entry if flyhost.json specifies one
    if (flyhostConfig.entry && analysis.pteroEnvUpdates) {
      const entryOverride = flyhostConfig.entry.trim();
      if (tech === "nodejs" || tech === "bun" || tech === "deno") {
        analysis.pteroEnvUpdates["MAIN_FILE"] = entryOverride;
        const newStartup = tech === "bun" ? buildBunStartup(entryOverride)
          : tech === "deno" ? buildDenoStartup(entryOverride)
          : buildNodeStartup(entryOverride);
        analysis.pteroEnvUpdates["STARTUP"] = newStartup;
        analysis.fixes.push(`Point d'entrée surchargé: ${entryOverride}`);
      } else if (tech === "python") {
        analysis.pteroEnvUpdates["PY_FILE"] = entryOverride;
        analysis.pteroEnvUpdates["STARTUP"] = `if [ -f /home/container/requirements.txt ]; then pip install -r /home/container/requirements.txt; fi; /usr/local/bin/python3 "/home/container/${entryOverride}"`;
        analysis.fixes.push(`Point d'entrée surchargé: ${entryOverride}`);
      }
    }

    await logDeploy(deploymentId, "info", `Analyse du projet (confiance: ${analysis.confidence}):`);
    for (const fix of analysis.fixes) {
      await logDeploy(deploymentId, "info", `  → ${fix}`);
    }

    // ── Egg switching: change Docker image if tech requires different environment ──
    const requiredEggKey = TECH_TO_EGG[tech] || "nodejs";
    const requiredEgg = EGG_CONFIGS[requiredEggKey];
    if (requiredEgg) {
      const currentEgg = await getServerCurrentEgg(identifier);
      const needsSwitch = currentEgg && currentEgg.eggId !== requiredEgg.eggId;
      if (needsSwitch) {
        await logDeploy(deploymentId, "info", `🔄 Changement d'environnement requis: egg ${currentEgg!.eggId} → egg ${requiredEgg.eggId} (${requiredEgg.label})`);
        const serverInfo = await getPteroServerByIdentifier(identifier);
        if (serverInfo) {
          const switchResult = await switchServerEgg(serverInfo.id, requiredEggKey, analysis.pteroEnvUpdates["STARTUP"] || "");
          if (switchResult.switched) {
            await logDeploy(deploymentId, "info", `  ✅ ${switchResult.message}`);
            await logDeploy(deploymentId, "info", `  ⏳ Attente de la réinstallation du container (30s)...`);
            await sleep(30000); // Wait for Wings to recreate the container
          } else {
            await logDeploy(deploymentId, "warn", `  ⚠️ ${switchResult.message}`);
            await logDeploy(deploymentId, "warn", `  ℹ️ Le déploiement continue — la commande de démarrage sera adaptée au maximum possible`);
          }
        }
      } else if (currentEgg) {
        await logDeploy(deploymentId, "info", `  ✅ Image Docker correcte: ${currentEgg.image}`);
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
        // Log actionable suggestions per tech type
        await logDeploy(deploymentId, "warn", `Suggestions de correction :`);
        if (tech === "nodejs" || tech === "bun" || tech === "deno") {
          const entry = analysis.pteroEnvUpdates["MAIN_FILE"] || "index.js";
          await logDeploy(deploymentId, "warn", `  • Vérifiez que votre point d'entrée (${entry}) existe et démarre sans erreur`);
          await logDeploy(deploymentId, "warn", `  • Ajoutez flyhost.json: { "runtime": "${tech}", "entry": "${entry}" }`);
          await logDeploy(deploymentId, "warn", `  • Votre app doit écouter sur process.env.PORT (assigné par Pterodactyl)`);
        } else if (tech === "python") {
          await logDeploy(deploymentId, "warn", `  • Vérifiez que requirements.txt liste toutes vos dépendances`);
          await logDeploy(deploymentId, "warn", `  • Ajoutez flyhost.json: { "runtime": "python", "entry": "main.py" }`);
          await logDeploy(deploymentId, "warn", `  • Votre app doit écouter sur le port $SERVER_PORT ou $PORT`);
        } else if (tech === "php") {
          await logDeploy(deploymentId, "warn", `  • Vérifiez que votre index.php est dans le bon dossier`);
          await logDeploy(deploymentId, "warn", `  • Ajoutez flyhost.json: { "runtime": "php" }`);
        } else if (tech === "ruby") {
          await logDeploy(deploymentId, "warn", `  • Ruby nécessite un serveur avec l'image Ruby installée`);
          await logDeploy(deploymentId, "warn", `  • Vérifiez que Gemfile liste toutes vos dépendances`);
        } else if (tech === "go") {
          await logDeploy(deploymentId, "warn", `  • Go nécessite un serveur avec l'image Go installée`);
          await logDeploy(deploymentId, "warn", `  • Assurez-vous que main.go existe à la racine`);
        } else {
          await logDeploy(deploymentId, "warn", `  • Consultez la console du serveur pour voir le message d'erreur`);
          await logDeploy(deploymentId, "warn", `  • Ajoutez flyhost.json: { "runtime": "<tech>", "start": "<commande>" }`);
        }
        // Still mark as deployed (server may need manual start with correct config)
        await logDeploy(deploymentId, "info", `Fichiers déployés — vérifiez la console du serveur pour diagnostiquer`);
      }
    } else {
      await logDeploy(deploymentId, "success", `Serveur opérationnel ✓`);
    }

    const duration = Math.round((Date.now() - start) / 1000);
    await logDeploy(deploymentId, "success", `Déploiement terminé en ${duration}s !`);

    // Auto-assign subdomain for web projects
    let deployUrl: string | null = null;
    if (WEB_TECHS.has(tech)) {
      try {
        const serverInfo = await getPteroServerByIdentifier(identifier);
        if (serverInfo) {
          const subdomain = generateSubdomain(serverInfo.name);
          const full = await getPteroServer(serverInfo.id);
          // Pterodactyl Application API wraps data under .attributes.relationships
          const allocData = full?.attributes?.relationships?.allocations?.data?.[0]?.attributes;
          const port: number | undefined = allocData?.port;
          // Set SERVER_SUBDOMAIN env var on Pterodactyl
          await updateServerEnvViaAppAPI(serverInfo.id, { SERVER_SUBDOMAIN: subdomain }).catch(() => {});
          // Ensure Cloudflare wildcard DNS exists
          await createSubdomainDNS(subdomain).catch(() => {});
          // Clean URL — no port (Cloudflare wildcard proxied → Express proxy → internal port)
          const subdomainUrl = `https://${subdomain}.flihost.site`;
          if (port) {
            const allocIp = allocData?.ip;
            // Use allocation IP (in prod = same machine; in dev = remote Wings)
            const targetIp = (allocIp && allocIp !== "0.0.0.0") ? allocIp : (process.env.SERVER_IP || "127.0.0.1");
            // Save subdomain → port mapping in DB for the reverse proxy
            await db.insert(serverSubdomainsTable)
              .values({
                subdomain,
                pterodactylIdentifier: identifier,
                port,
                ip: targetIp,
                userId: opts.userId ?? null,
              })
              .onConflictDoUpdate({
                target: serverSubdomainsTable.subdomain,
                set: { port, pterodactylIdentifier: identifier, ip: targetIp, updatedAt: new Date() },
              })
              .catch(() => {});
            // Update in-memory proxy cache immediately
            setCacheEntry(subdomain, port, targetIp);
            deployUrl = subdomainUrl;
          }
          await logDeploy(deploymentId, "info", `🔗 URL de l'app   : ${subdomainUrl}`);
        }
      } catch { /* non-blocking — subdomain assignment is best-effort */ }
    }

    await db.update(deploymentsTable).set({
      status: "deployed",
      duration,
      url: deployUrl,
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
    nodejs:    "node index.js",
    bun:       "bun run index.ts",
    deno:      "deno run --allow-net --allow-read --allow-env main.ts",
    python:    "python main.py",
    php:       "php -S 0.0.0.0:${SERVER_PORT:-3000}",
    java:      "java -jar app.jar",
    ruby:      "ruby app.rb",
    go:        "go run main.go",
    "rust-lang": "cargo run --release",
    static:    "npx --yes serve . --listen ${SERVER_PORT:-3000}",
  };
  return map[tech] || "node index.js";
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

// Helper: build Python startup string (pip install + run)
function buildPyStartup(cmd: string): string {
  return `if [ -f /home/container/requirements.txt ]; then pip install -r /home/container/requirements.txt 2>&1 || true; fi; ${cmd}`;
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

  // ── Django ────────────────────────────────────────────────────────────
  if (isDjango && fs.existsSync(path.join(srcDir, "manage.py"))) {
    fixes.push(`Django détecté → manage.py runserver`);
    const startupCmd = buildPyStartup(`/usr/local/bin/python3 /home/container/manage.py runserver 0.0.0.0:\${SERVER_PORT:-8000}`);
    pteroEnvUpdates["PY_FILE"] = "manage.py";
    pteroEnvUpdates["REQUIREMENTS_FILE"] = "requirements.txt";
    pteroEnvUpdates["STARTUP"] = startupCmd;
    return {
      startCommand: "python manage.py runserver 0.0.0.0:${SERVER_PORT:-8000}",
      pteroEnvUpdates, fixes, confidence: "high",
    };
  }

  // ── FastAPI / uvicorn ─────────────────────────────────────────────────
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
    const startupCmd = buildPyStartup(`uvicorn ${module}:${appVar} --host 0.0.0.0 --port \${SERVER_PORT:-8000}`);
    pteroEnvUpdates["PY_FILE"] = entryFile || "main.py";
    pteroEnvUpdates["REQUIREMENTS_FILE"] = "requirements.txt";
    pteroEnvUpdates["STARTUP"] = startupCmd;
    return {
      startCommand: `uvicorn ${module}:${appVar} --host 0.0.0.0 --port \${SERVER_PORT:-8000}`,
      pteroEnvUpdates, fixes, confidence: "high",
    };
  }

  // ── Flask ─────────────────────────────────────────────────────────────
  if (isFlask) {
    const pyEntry = entryFile || "app.py";
    const module = path.basename(pyEntry, ".py");
    fixes.push(`Flask détecté → ${isGunicorn ? "gunicorn" : "python"} ${pyEntry}`);
    const runCmd = isGunicorn
      ? `gunicorn ${module}:app --bind 0.0.0.0:\${SERVER_PORT:-8000}`
      : `/usr/local/bin/python3 /home/container/${pyEntry}`;
    const startupCmd = buildPyStartup(runCmd);
    pteroEnvUpdates["PY_FILE"] = pyEntry;
    pteroEnvUpdates["REQUIREMENTS_FILE"] = "requirements.txt";
    pteroEnvUpdates["STARTUP"] = startupCmd;
    return {
      startCommand: isGunicorn ? `gunicorn ${module}:app --bind 0.0.0.0:3000` : `python ${pyEntry}`,
      pteroEnvUpdates, fixes, confidence: "high",
    };
  }

  // ── Generic Python ────────────────────────────────────────────────────
  if (!entryFile) {
    entryFile = "main.py";
    fixes.push(`Aucun point d'entrée trouvé — défaut: main.py`);
  } else {
    fixes.push(`Point d'entrée auto-détecté : ${entryFile}`);
  }
  const startupCmd = buildPyStartup(`/usr/local/bin/python3 /home/container/${entryFile}`);
  pteroEnvUpdates["PY_FILE"] = entryFile;
  pteroEnvUpdates["REQUIREMENTS_FILE"] = "requirements.txt";
  pteroEnvUpdates["STARTUP"] = startupCmd;

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

// ─────────────────────────────────────────────────────────────────────────────
//  New analyzers: Bun, Deno, Ruby, Go, Rust, Static
// ─────────────────────────────────────────────────────────────────────────────

function analyzeBunProject(srcDir: string): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  let pkg: Record<string, any> = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(srcDir, "package.json"), "utf8")); } catch {}

  // Find entry point (same logic as node, but prefer bun-specific patterns)
  let mainFile = pkg.main || "";
  if (!mainFile && pkg.module) { mainFile = pkg.module; }
  if (!mainFile && pkg.scripts?.start) {
    const m = pkg.scripts.start.match(/(?:bun|node|ts-node|tsx)\s+(?:run\s+)?([^\s]+)/);
    if (m) mainFile = m[1];
  }
  if (!mainFile) {
    for (const c of ["index.ts", "index.js", "src/index.ts", "src/index.js", "app.ts", "app.js", "server.ts", "server.js"]) {
      if (fs.existsSync(path.join(srcDir, c))) { mainFile = c; break; }
    }
  }
  if (!mainFile) mainFile = "index.ts";

  fixes.push(`Runtime: Bun (avec fallback Node.js si bun indisponible)`);
  fixes.push(`Point d'entrée: ${mainFile}`);
  if (fs.existsSync(path.join(srcDir, "package.json"))) fixes.push("package.json présent → npm install avant démarrage");

  const startupCmd = buildBunStartup(mainFile);
  pteroEnvUpdates["MAIN_FILE"] = mainFile;
  pteroEnvUpdates["STARTUP"] = startupCmd;

  return { startCommand: `bun run ${mainFile}`, pteroEnvUpdates, fixes, confidence: "high" };
}

function analyzeDenoProject(srcDir: string): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  let mainFile = "main.ts";
  let confidence: "high" | "medium" | "low" = "medium";

  // Check deno.json for tasks
  let denoCfg: Record<string, any> = {};
  try { denoCfg = JSON.parse(fs.readFileSync(path.join(srcDir, "deno.json"), "utf8")); } catch {}
  try { denoCfg = JSON.parse(fs.readFileSync(path.join(srcDir, "deno.jsonc"), "utf8")); } catch {}

  if (denoCfg.tasks?.start) {
    const m = denoCfg.tasks.start.match(/deno\s+run[^\s]*\s+([^\s]+)/);
    if (m) { mainFile = m[1]; confidence = "high"; fixes.push(`deno.json tasks.start → ${mainFile}`); }
  } else if (denoCfg.main) {
    mainFile = denoCfg.main; confidence = "high"; fixes.push(`deno.json main → ${mainFile}`);
  } else {
    for (const c of ["main.ts", "mod.ts", "index.ts", "server.ts", "app.ts", "main.js"]) {
      if (fs.existsSync(path.join(srcDir, c))) { mainFile = c; fixes.push(`Point d'entrée Deno: ${c}`); break; }
    }
  }

  fixes.push(`Runtime: Deno (avec fallback Node.js si deno indisponible)`);

  const startupCmd = buildDenoStartup(mainFile);
  pteroEnvUpdates["MAIN_FILE"] = mainFile;
  pteroEnvUpdates["STARTUP"] = startupCmd;

  return { startCommand: `deno run --allow-net --allow-read --allow-env ${mainFile}`, pteroEnvUpdates, fixes, confidence };
}

function analyzeRubyProject(srcDir: string): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  let mainFile = "";
  let confidence: "high" | "medium" | "low" = "medium";
  let startCmd = "";

  // Detect Rails
  if (fs.existsSync(path.join(srcDir, "config", "application.rb"))) {
    fixes.push("Ruby on Rails détecté → rails server");
    startCmd = `if [ -f /home/container/Gemfile ]; then bundle install 2>&1 || true; fi; cd /home/container && bundle exec rails server -b 0.0.0.0 -p \${SERVER_PORT:-3000}`;
    confidence = "high";
  }
  // Detect Sinatra (config.ru)
  else if (fs.existsSync(path.join(srcDir, "config.ru"))) {
    fixes.push("Rack/Sinatra détecté → bundle exec rackup");
    startCmd = `if [ -f /home/container/Gemfile ]; then bundle install 2>&1 || true; fi; cd /home/container && bundle exec rackup --host 0.0.0.0 --port \${SERVER_PORT:-3000}`;
    confidence = "high";
  }
  // Generic Ruby
  else {
    for (const c of ["app.rb", "main.rb", "server.rb", "run.rb", "index.rb"]) {
      if (fs.existsSync(path.join(srcDir, c))) { mainFile = c; break; }
    }
    if (!mainFile) { mainFile = "app.rb"; confidence = "low"; }
    else confidence = "high";
    fixes.push(`Point d'entrée Ruby: ${mainFile}`);
    startCmd = buildRubyStartup(mainFile);
  }

  pteroEnvUpdates["STARTUP"] = startCmd;
  fixes.push(`⚠️ Ruby nécessite un serveur avec l'image Ruby. Sans ruby binaire, le lancement échouera.`);

  return { startCommand: startCmd, pteroEnvUpdates, fixes, confidence };
}

function analyzeGoProject(srcDir: string): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  let mainFile = "main.go";
  let confidence: "high" | "medium" | "low" = "medium";

  // Find the main package
  if (fs.existsSync(path.join(srcDir, "main.go"))) {
    mainFile = "main.go"; confidence = "high"; fixes.push("main.go trouvé");
  } else if (fs.existsSync(path.join(srcDir, "cmd", "main.go"))) {
    mainFile = "cmd/main.go"; confidence = "high"; fixes.push("cmd/main.go (structure Go standard)");
  } else {
    fixes.push("Aucun main.go trouvé — défaut: main.go");
    confidence = "low";
  }

  // Read go.mod for module name
  let modName = "";
  try {
    const goMod = fs.readFileSync(path.join(srcDir, "go.mod"), "utf8");
    const m = goMod.match(/^module\s+(.+)$/m);
    if (m) { modName = m[1].trim(); fixes.push(`Module Go: ${modName}`); }
  } catch {}

  const startupCmd = buildGoStartup(mainFile);
  pteroEnvUpdates["STARTUP"] = startupCmd;
  fixes.push(`⚠️ Go nécessite un serveur avec l'image Go. Sans go binaire, le lancement échouera.`);

  return { startCommand: `go run ${mainFile}`, pteroEnvUpdates, fixes, confidence };
}

function analyzeRustLangProject(srcDir: string): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  // Read Cargo.toml for binary name
  let binName = "";
  try {
    const cargoToml = fs.readFileSync(path.join(srcDir, "Cargo.toml"), "utf8");
    const m = cargoToml.match(/^\[package\][\s\S]*?name\s*=\s*"([^"]+)"/m);
    if (m) { binName = m[1]; fixes.push(`Crate Rust: ${binName}`); }
  } catch {}

  const startupCmd = `if command -v cargo &>/dev/null; then cd /home/container && cargo build --release 2>&1 && ./target/release/${binName || "app"}; else echo "Cargo/Rust non disponible dans cette image"; fi`;
  pteroEnvUpdates["STARTUP"] = startupCmd;
  fixes.push(`⚠️ Rust nécessite un serveur avec Cargo/Rust installé.`);

  return {
    startCommand: `cargo run --release`,
    pteroEnvUpdates, fixes, confidence: binName ? "high" : "low",
  };
}

function analyzeStaticProject(srcDir: string, files: string[]): ProjectAnalysis {
  const fixes: string[] = [];
  const pteroEnvUpdates: Record<string, string> = {};

  // Detect document root
  let docRoot = ".";
  if (fs.existsSync(path.join(srcDir, "dist", "index.html"))) {
    docRoot = "dist"; fixes.push("Dossier dist/ détecté (build Vite/Webpack)");
  } else if (fs.existsSync(path.join(srcDir, "build", "index.html"))) {
    docRoot = "build"; fixes.push("Dossier build/ détecté");
  } else if (fs.existsSync(path.join(srcDir, "public", "index.html"))) {
    docRoot = "public"; fixes.push("Dossier public/");
  } else {
    fixes.push("index.html à la racine");
  }

  fixes.push(`Serveur de fichiers statiques: npx serve ${docRoot}`);

  const startupCmd = buildStaticStartup(docRoot);
  pteroEnvUpdates["STARTUP"] = startupCmd;
  pteroEnvUpdates["MAIN_FILE"] = `${docRoot}/index.html`;

  return { startCommand: `npx serve ${docRoot}`, pteroEnvUpdates, fixes, confidence: "high" };
}

export function analyzeProject(srcDir: string, tech: string, files: string[]): ProjectAnalysis {
  switch (tech) {
    case "nodejs":    return analyzeNodeProject(srcDir);
    case "bun":       return analyzeBunProject(srcDir);
    case "deno":      return analyzeDenoProject(srcDir);
    case "python":    return analyzePythonProject(srcDir);
    case "php":       return analyzePhpProject(srcDir);
    case "java":      return analyzeJavaProject(srcDir, files);
    case "ruby":      return analyzeRubyProject(srcDir);
    case "go":        return analyzeGoProject(srcDir);
    case "rust-lang": return analyzeRustLangProject(srcDir);
    case "static":    return analyzeStaticProject(srcDir, files);
    default:
      return { startCommand: getDefaultStart(tech), pteroEnvUpdates: {}, fixes: [`Tech: ${tech} (non reconnue — commande par défaut)`], confidence: "low" };
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
    // Accept "running" or "starting" — npm install may take longer than the wait window
    return state === "running" || state === "starting";
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
    runDeploy(deployment.id, identifier, srcDir, { envVars, userId: req.userId ?? null }).finally(() => {
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

        await runDeploy(deployment.id, identifier, tmpDir, { envVars, startCommand, userId: deployment.userId ?? null });
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
