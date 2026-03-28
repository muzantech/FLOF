import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { notificationsTable, serverMetricsTable, restartSchedulesTable } from "@workspace/db";
import { eq, lt, sql, and, isNull, or } from "drizzle-orm";
import { deploymentsTable } from "@workspace/db";
import { sendEmail, emailTemplates, sendDiscordWebhook, sendTelegram } from "./mailer";
import { createNotification } from "./routes/notifications";
import {
  getServerResourceUsage,
  sendPowerAction,
  deletePteroServer,
  listPteroServers,
} from "./pterodactyl";
import { rmSync } from "fs";
import { join } from "path";
import { readdirSync, statSync } from "fs";

// Server plan prices (coins/month)
const PLAN_PRICES: Record<string, number> = {
  nodejs: 50, python: 50, php: 50, java: 75,
  "vanilla-mc": 100, "paper-mc": 120, "forge-mc": 150,
  rust: 200, csgo: 150, gmod: 100, teamspeak: 30,
};

function log(msg: string) { console.log(`[cron] ${new Date().toISOString()} ${msg}`); }

// ─── Helper: find servers from Pterodactyl and cross-ref with our DB ──────────
// Since we don't have a dedicated servers table, we track via deployments/Pterodactyl
// For now crons operate on Pterodactyl data and coin transactions

// ─── Collect server metrics every 5 minutes ──────────────────────────────────
export async function collectMetrics() {
  log("Collecting server metrics...");
  try {
    const pteroServers = await listPteroServers();
    const servers = pteroServers.data || [];

    for (const s of servers) {
      const identifier = s.attributes?.identifier;
      if (!identifier) continue;
      try {
        const usage = await getServerResourceUsage(identifier);
        const res = usage.attributes?.resources || {};
        const state = usage.attributes?.current_state || "offline";
        const cpuPercent = res.cpu_absolute || 0;
        const ramMb = (res.memory_bytes || 0) / 1024 / 1024;
        const diskMb = (res.disk_bytes || 0) / 1024 / 1024;

        await db.insert(serverMetricsTable).values({
          serverId: identifier,
          cpuPercent,
          ramMb,
          diskMb,
          networkRx: res.network_rx_bytes || 0,
          networkTx: res.network_tx_bytes || 0,
          state,
        });

        // Alert if CPU > 90%
        if (cpuPercent > 90) {
          log(`⚠️ CPU alert: ${identifier} at ${cpuPercent.toFixed(1)}%`);
          // Find owner via Pterodactyl user id (best effort)
          // We notify via the notification system if we can find the owner
          const serverName = s.attributes?.name || identifier;
          const tpl = emailTemplates.cpuAlert(serverName, cpuPercent);
          // Attempt to find the user from the server owner
          const ownerId = s.attributes?.user;
          if (ownerId) {
            // Try to find our user
            const users = await db.select().from(usersTable).limit(1); // heuristic
            for (const u of users) {
              if (u.telegramChatId) await sendTelegram(u.telegramChatId, `🔥 ${serverName} : CPU à ${cpuPercent.toFixed(1)}%`);
              if (u.discordWebhook) await sendDiscordWebhook(u.discordWebhook, `🔥 **${serverName}** : CPU à **${cpuPercent.toFixed(1)}%**`);
            }
          }
        }
      } catch {}
    }
  } catch (err) {
    log(`collectMetrics error: ${err}`);
  }
}

// ─── Fix stuck builds every hour ─────────────────────────────────────────────
export async function fixStuckBuilds() {
  log("Checking for stuck builds...");
  try {
    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);
    await db.update(deploymentsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(
          eq(deploymentsTable.status, "building"),
          lt(deploymentsTable.createdAt, fifteenMinsAgo),
        )
      );
  } catch (err) {
    log(`fixStuckBuilds error: ${err}`);
  }
}

// ─── Clean up /tmp deploy dirs older than 2 hours ────────────────────────────
export async function cleanupTmpDirs() {
  log("Cleaning up /tmp deploy dirs...");
  try {
    const tmpPath = "/tmp";
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const entries = readdirSync(tmpPath);
    for (const entry of entries) {
      if (!entry.startsWith("flyhost-deploy-")) continue;
      const fullPath = join(tmpPath, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.mtimeMs < twoHoursAgo) {
          rmSync(fullPath, { recursive: true, force: true });
          log(`Cleaned up ${fullPath}`);
        }
      } catch {}
    }
  } catch (err) {
    log(`cleanupTmpDirs error: ${err}`);
  }
}

// ─── Expiration alerts ────────────────────────────────────────────────────────
export async function sendExpirationAlerts() {
  log("Checking server expiration alerts...");
  // Note: Server expiration would be tracked in a dedicated servers table
  // For now this is a no-op placeholder — the full implementation would query
  // a servers table with expires_at and send emails/notifications
  // This gets activated when the servers table with expiration is added
}

// ─── Auto-renewal cron ────────────────────────────────────────────────────────
export async function processAutoRenewals() {
  log("Processing auto-renewals...");
  // Same as above — requires the servers table with auto_renew + expires_at
  // Implementation placeholder; activates when server persistence is added
}

// ─── Check restart schedules ──────────────────────────────────────────────────
export async function processRestartSchedules() {
  log("Processing restart schedules...");
  try {
    const now = new Date();
    const schedules = await db.select().from(restartSchedulesTable)
      .where(eq(restartSchedulesTable.enabled, 1));

    for (const sched of schedules) {
      const lastRun = sched.lastRun ? new Date(sched.lastRun) : null;
      const shouldRun = shouldRunSchedule(sched.frequency, sched.hour, sched.minute, now, lastRun);
      if (!shouldRun) continue;

      try {
        await sendPowerAction(sched.serverId, "restart");
        await db.update(restartSchedulesTable)
          .set({ lastRun: now })
          .where(eq(restartSchedulesTable.id, sched.id));
        log(`Restarted server ${sched.serverId} via schedule #${sched.id}`);
      } catch (err) {
        log(`Schedule restart failed for ${sched.serverId}: ${err}`);
      }
    }
  } catch (err) {
    log(`processRestartSchedules error: ${err}`);
  }
}

function shouldRunSchedule(
  frequency: string,
  hour: number,
  minute: number,
  now: Date,
  lastRun: Date | null
): boolean {
  const nowH = now.getHours();
  const nowM = now.getMinutes();
  if (nowH !== hour || nowM !== minute) return false;

  if (!lastRun) return true;

  const diff = now.getTime() - lastRun.getTime();
  if (frequency === "hourly" && diff < 60 * 60 * 1000) return false;
  if (frequency === "daily" && diff < 23 * 60 * 60 * 1000) return false;
  if (frequency === "weekly" && diff < 6 * 24 * 60 * 60 * 1000) return false;
  return true;
}

// ─── Start all crons ──────────────────────────────────────────────────────────
export function startCronJobs() {
  log("Starting cron jobs...");

  // Every 5 minutes: collect metrics
  setInterval(collectMetrics, 5 * 60 * 1000);

  // Every hour: fix stuck builds + cleanup tmp
  setInterval(() => {
    fixStuckBuilds();
    cleanupTmpDirs();
    processAutoRenewals();
    sendExpirationAlerts();
  }, 60 * 60 * 1000);

  // Every minute: restart schedules
  setInterval(processRestartSchedules, 60 * 1000);

  // Run immediately on startup
  fixStuckBuilds();
  cleanupTmpDirs();
  collectMetrics();

  log("✅ Cron jobs started");
}
