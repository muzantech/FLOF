import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  EGG_CONFIGS,
  getOrCreatePteroUser,
  createPteroServer,
  suspendPteroServer,
  unsuspendPteroServer,
  deletePteroServer,
  getPteroServerByIdentifier,
  listPteroServers,
  getPteroServer,
  sendPowerAction,
  getServerResourceUsage,
  getServerConsoleToken,
  listServerFiles,
  getFileContents,
  writeFileContents,
  createServerFolder,
  renameServerFile,
  deleteServerFiles,
  getServerStats,
  testClientKey,
} from "../pterodactyl";

const router: IRouter = Router();

// Server pricing (coins per month)
const SERVER_PRICES: Record<string, { coins: number; label: string }> = {
  "nodejs":     { coins: 50,  label: "Node.js" },
  "python":     { coins: 50,  label: "Python" },
  "php":        { coins: 50,  label: "PHP" },
  "java":       { coins: 75,  label: "Java générique" },
  "vanilla-mc": { coins: 100, label: "Minecraft Vanilla" },
  "paper-mc":   { coins: 120, label: "Minecraft Paper" },
  "forge-mc":   { coins: 150, label: "Minecraft Forge" },
  "rust":       { coins: 200, label: "Rust (jeu)" },
  "csgo":       { coins: 150, label: "CS:GO" },
  "gmod":       { coins: 100, label: "Garry's Mod" },
  "teamspeak":  { coins: 30,  label: "TeamSpeak 3" },
};

// GET /api/servers/plans — list available server types with pricing
router.get("/servers/plans", requireAuth, (_req, res): void => {
  const plans = Object.entries(EGG_CONFIGS).map(([id, cfg]) => ({
    id,
    label: cfg.label,
    coins: SERVER_PRICES[id]?.coins ?? 50,
    limits: cfg.limits,
    category: getCategoryForType(id),
  }));
  res.json({ plans });
});

function getCategoryForType(type: string): string {
  if (["vanilla-mc", "paper-mc", "forge-mc"].includes(type)) return "minecraft";
  if (["csgo", "gmod", "rust"].includes(type)) return "gaming";
  if (["nodejs", "python", "php", "java"].includes(type)) return "web";
  if (["teamspeak"].includes(type)) return "voice";
  return "other";
}

// GET /api/servers — list all servers (admin) or filtered by user ptero ID
router.get("/servers", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const isAdmin = user.role === "admin" || user.role === "superadmin";

    if (isAdmin) {
      // Admin sees all servers
      const data = await listPteroServers();
      const servers = data.data?.map((s: any) => formatServer(s)) || [];
      res.json({ servers, total: data.meta?.pagination?.total || servers.length });
    } else {
      // User sees only their own servers (matched by email)
      const data = await listPteroServers();
      const allServers = data.data || [];
      // Filter by user's pteroUserId stored in description or by checking ptero user email
      // For now return all — in production filter by pteroUserId
      const servers = allServers.map((s: any) => formatServer(s));
      res.json({ servers });
    }
  } catch (err: any) {
    console.error("List servers error:", err);
    res.status(500).json({ error: err.message || "Erreur Pterodactyl" });
  }
});

// POST /api/servers — create a server
router.post("/servers", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { name, gameType, memory, disk, cpu } = req.body;

    if (!name || !gameType) {
      res.status(400).json({ error: "Nom et type de serveur requis" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const price = SERVER_PRICES[gameType];
    if (!price) { res.status(400).json({ error: "Type de serveur invalide" }); return; }

    if (user.coins < price.coins) {
      res.status(402).json({
        error: `Coins insuffisants. Nécessaire: ${price.coins}, Disponible: ${user.coins}`,
        required: price.coins,
        available: user.coins,
      });
      return;
    }

    // Ensure Pterodactyl user exists for this FlyHost user (idempotent)
    const pteroUser = await getOrCreatePteroUser(user.email, user.id, user.name || user.username || "FlyHost User");
    const pteroUserId = pteroUser.attributes.id;

    // Create server on Pterodactyl
    const serverData = await createPteroServer({
      name: `${name} [FH-${user.id}]`,
      ownerId: pteroUserId,
      gameType,
      memory,
      disk,
      cpu,
    });

    // Deduct coins
    await db.update(usersTable)
      .set({ coins: sql`coins - ${price.coins}` })
      .where(eq(usersTable.id, req.userId!));

    await db.insert(coinTransactionsTable).values({
      userId: req.userId!,
      type: "debit",
      category: "server_creation",
      amount: price.coins,
      description: `Création serveur ${price.label}: ${name}`,
      reference: `server_${serverData.attributes.id}`,
    });

    res.status(201).json({
      server: formatServer(serverData),
      coinsDeducted: price.coins,
      coinsRemaining: user.coins - price.coins,
    });
  } catch (err: any) {
    console.error("Create server error:", err);
    res.status(500).json({ error: err.message || "Erreur création serveur" });
  }
});

// GET /api/servers/:id — get server details
router.get("/servers/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const data = await getPteroServer(serverId);
    res.json({ server: formatServer(data) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/power — send power action
router.post("/servers/:id/power", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { action } = req.body; // start | stop | restart | kill
    const identifier = req.params.id;
    if (!["start", "stop", "restart", "kill"].includes(action)) {
      res.status(400).json({ error: "Action invalide" });
      return;
    }
    await sendPowerAction(identifier, action);
    res.json({ success: true, action });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/suspend — suspend server
router.post("/servers/:id/suspend", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      res.status(403).json({ error: "Admin requis" }); return;
    }
    await suspendPteroServer(serverId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:id/unsuspend — unsuspend server
router.post("/servers/:id/unsuspend", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const serverId = parseInt(req.params.id, 10);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      res.status(403).json({ error: "Admin requis" }); return;
    }
    await unsuspendPteroServer(serverId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/servers/:id — delete server (accepts numeric ID or string identifier)
router.delete("/servers/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const raw = req.params.id;
    let serverId: number;

    const numericId = parseInt(raw, 10);
    if (!isNaN(numericId) && String(numericId) === raw) {
      serverId = numericId;
    } else {
      // Treat as string identifier — look up numeric ID
      const found = await getPteroServerByIdentifier(raw);
      if (!found) {
        res.status(404).json({ error: "Serveur introuvable" });
        return;
      }
      serverId = found.id;
    }

    await deletePteroServer(serverId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ptero/test — test Pterodactyl connection (admin only)
router.get("/ptero/test", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      res.status(403).json({ error: "Admin requis" }); return;
    }
    const [data, clientTest] = await Promise.all([
      listPteroServers(),
      testClientKey(),
    ]);
    res.json({
      connected: true,
      clientConnected: clientTest.ok,
      clientError: clientTest.ok ? null : clientTest.error,
      panelUrl: process.env.PTERODACTYL_URL,
      totalServers: data.meta?.pagination?.total || 0,
      nodeId: 1,
      locationId: 1,
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// ══════════════════════════════════════════
// SERVER DETAIL — Console, Files, Stats
// ══════════════════════════════════════════

// GET /api/servers/:identifier/console — get WebSocket token for console
router.get("/servers/:identifier/console", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const data = await getServerConsoleToken(req.params.identifier);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/servers/:identifier/stats — get resource usage
router.get("/servers/:identifier/stats", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const data = await getServerStats(req.params.identifier);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/servers/:identifier/files — list files in directory
router.get("/servers/:identifier/files", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const directory = (req.query.directory as string) || "/";
    const data = await listServerFiles(req.params.identifier, directory);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/servers/:identifier/files/contents — get file content
router.get("/servers/:identifier/files/contents", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const file = req.query.file as string;
    if (!file) { res.status(400).json({ error: "file parameter required" }); return; }
    const content = await getFileContents(req.params.identifier, file);
    res.json({ content, file });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:identifier/files/write — write file content
router.post("/servers/:identifier/files/write", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { file, content } = req.body;
    if (!file || content === undefined) { res.status(400).json({ error: "file and content required" }); return; }
    await writeFileContents(req.params.identifier, file, content);
    res.json({ success: true, file });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:identifier/files/folder — create folder
router.post("/servers/:identifier/files/folder", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { directory, name } = req.body;
    await createServerFolder(req.params.identifier, directory || "/", name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/servers/:identifier/files/rename — rename a file
router.put("/servers/:identifier/files/rename", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { root, from, to } = req.body;
    await renameServerFile(req.params.identifier, root || "/", from, to);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/servers/:identifier/files — delete files
router.delete("/servers/:identifier/files", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { root, files } = req.body;
    await deleteServerFiles(req.params.identifier, root || "/", files);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/servers/:identifier/deploy — deploy project files to server
router.post("/servers/:identifier/deploy", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { identifier } = req.params;
    const { gitUrl, branch, envVars, template, startCommand, projectName } = req.body;

    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);

    log(`[info] Déploiement sur le serveur ${identifier}...`);

    // Write .env file from env vars
    if (envVars && Object.keys(envVars).length > 0) {
      const envContent = Object.entries(envVars as Record<string, string>)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      await writeFileContents(identifier, "/home/container/.env", envContent);
      log(`[info] Fichier .env écrit (${Object.keys(envVars).length} variables)`);
    }

    // Write .flyhost.json config
    const config = {
      projectName: projectName || "app",
      gitUrl: gitUrl || null,
      branch: branch || "main",
      deployedAt: new Date().toISOString(),
      platform: "flyhost",
    };
    await writeFileContents(identifier, "/home/container/.flyhost.json", JSON.stringify(config, null, 2));
    log(`[info] Configuration FlyHost écrite`);

    if (gitUrl) {
      // Write deploy.sh that clones/pulls and installs deps
      const branchSafe = (branch || "main").replace(/[^a-zA-Z0-9._/-]/g, "");
      const deployScript = [
        "#!/bin/bash",
        "set -e",
        `echo "[flyhost] Clonage depuis ${gitUrl}..."`,
        `if [ -d /home/container/app/.git ]; then`,
        `  cd /home/container/app && git fetch origin && git reset --hard origin/${branchSafe}`,
        `else`,
        `  git clone --branch ${branchSafe} --depth 1 ${gitUrl} /home/container/app`,
        `fi`,
        `cd /home/container/app`,
        `[ -f package.json ] && npm install --production`,
        `[ -f requirements.txt ] && pip install -r requirements.txt`,
        `[ -f composer.json ] && composer install --no-dev`,
        `echo "[flyhost] Déploiement terminé !"`,
        startCommand ? `exec ${startCommand}` : `[ -f package.json ] && exec node . || exec python main.py`,
      ].join("\n");
      await writeFileContents(identifier, "/home/container/deploy.sh", deployScript);
      log(`[build] Script de déploiement Git écrit`);
      log(`[build] Repo: ${gitUrl} (branche: ${branchSafe})`);
    } else if (template) {
      // Write template starter files
      const files = getTemplateFiles(template, projectName || "app");
      for (const [filePath, content] of Object.entries(files)) {
        await writeFileContents(identifier, `/home/container/${filePath}`, content);
        log(`[build] Fichier créé: ${filePath}`);
      }
    }

    // Power start the server
    try {
      await sendPowerAction(identifier, "restart");
      log(`[info] Serveur redémarré`);
    } catch {
      await sendPowerAction(identifier, "start");
      log(`[info] Serveur démarré`);
    }

    log(`[success] Déploiement terminé avec succès !`);
    res.json({ success: true, identifier, logs });
  } catch (err: any) {
    console.error("Deploy error:", err);
    res.status(500).json({ error: err.message, logs: [`[error] ${err.message}`] });
  }
});

function getTemplateFiles(template: string, projectName: string): Record<string, string> {
  switch (template) {
    case "nodejs":
    case "express":
      return {
        "index.js": `const express = require('express');\nconst app = express();\nconst PORT = process.env.PORT || 3000;\napp.use(express.json());\napp.get('/', (req, res) => res.json({ message: 'Bonjour depuis ${projectName} !', platform: 'FlyHost' }));\napp.listen(PORT, () => console.log(\`Serveur démarré sur le port \${PORT}\`));\n`,
        "package.json": JSON.stringify({ name: projectName.toLowerCase().replace(/\s/g, "-"), version: "1.0.0", main: "index.js", scripts: { start: "node index.js" }, dependencies: { express: "^4.18.2" } }, null, 2),
        "README.md": `# ${projectName}\n\nDéployé avec FlyHost.\n`,
      };
    case "python":
      return {
        "main.py": `from flask import Flask, jsonify\nimport os\napp = Flask(__name__)\nPORT = int(os.environ.get('PORT', 3000))\n@app.route('/')\ndef index():\n    return jsonify({'message': 'Bonjour depuis ${projectName} !', 'platform': 'FlyHost'})\nif __name__ == '__main__':\n    app.run(host='0.0.0.0', port=PORT)\n`,
        "requirements.txt": "flask>=2.3.0\n",
        "README.md": `# ${projectName}\n\nDéployé avec FlyHost.\n`,
      };
    case "php":
      return {
        "index.php": `<?php\nheader('Content-Type: application/json');\necho json_encode(['message' => 'Bonjour depuis ${projectName} !', 'platform' => 'FlyHost']);\n`,
        "README.md": `# ${projectName}\n\nDéployé avec FlyHost.\n`,
      };
    case "java":
      return {
        "Main.java": `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Bonjour depuis ${projectName} !");\n    }\n}\n`,
      };
    case "static":
    case "react":
    case "vue":
    default:
      return {
        "index.html": `<!DOCTYPE html>\n<html lang="fr">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${projectName}</title><style>body{font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}h1{color:#facc15}</style></head>\n<body><div style="text-align:center"><h1>⚡ ${projectName}</h1><p>Déployé avec FlyHost</p></div></body>\n</html>\n`,
        "README.md": `# ${projectName}\n\nDéployé avec FlyHost.\n`,
      };
  }
}

function formatServer(s: any) {
  const a = s.attributes;
  return {
    id: a.id,
    uuid: a.uuid,
    identifier: a.identifier,
    name: a.name,
    description: a.description,
    status: a.status,
    suspended: a.suspended,
    limits: a.limits,
    featureLimits: a.feature_limits,
    node: a.node,
    allocation: a.relationships?.allocations?.data?.[0]?.attributes,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

export default router;
