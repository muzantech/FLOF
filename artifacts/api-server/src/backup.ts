import cron from "node-cron";
import fs from "fs";
import path from "path";
import { pool } from "@workspace/db";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 7;

const TABLES = [
  "users", "teams", "projects", "deployments", "domains", "env_vars",
  "subscriptions", "notifications", "payments", "coin_transactions",
  "servers", "server_subdomains", "api_keys", "referrals",
];

async function runBackup(): Promise<void> {
  const ts = new Date().toISOString().slice(0, 10);
  const backupPath = path.join(BACKUP_DIR, `backup-${ts}.json`);

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  console.log(`[backup] Démarrage du backup — ${ts}`);
  const backup: Record<string, any[]> = {};

  for (const table of TABLES) {
    try {
      const result = await pool.query(`SELECT * FROM "${table}"`);
      backup[table] = result.rows;
    } catch {
      backup[table] = [];
    }
  }

  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`[backup] Backup sauvegardé : ${backupPath} (${Math.round(fs.statSync(backupPath).size / 1024)} Ko)`);

  // Rotation : garder seulement les MAX_BACKUPS derniers fichiers
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
    .sort();

  while (files.length > MAX_BACKUPS) {
    const oldest = files.shift()!;
    fs.unlinkSync(path.join(BACKUP_DIR, oldest));
    console.log(`[backup] Ancien backup supprimé : ${oldest}`);
  }
}

export function startBackupCron(): void {
  // Backup quotidien à 2h du matin
  cron.schedule("0 2 * * *", () => {
    runBackup().catch(err => console.error("[backup] Erreur:", err?.message));
  });

  console.log("[backup] Cron de backup planifié — tous les jours à 2h00");
}

export { runBackup };
