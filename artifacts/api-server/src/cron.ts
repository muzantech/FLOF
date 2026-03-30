import { db, usersTable, coinTransactionsTable, serverSubdomainsTable } from "@workspace/db";
import { notificationsTable, serverMetricsTable, restartSchedulesTable } from "@workspace/db";
import { eq, lt, sql, and, isNull, or, lte } from "drizzle-orm";
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

// ─── In-memory cache for server state monitoring ────────────────────────────
const serverStateCache = new Map<string, string>(); // serverId → last known state

// ─── Monitor server states and send email alerts ─────────────────────────────
export async function monitorServerStates() {
  log("Monitoring server states for alerts...");
  try {
    const pteroServers = await listPteroServers();
    const servers = pteroServers.data || [];

    for (const s of servers) {
      const identifier = s.attributes?.identifier;
      const serverName = s.attributes?.name || identifier;
      if (!identifier) continue;

      try {
        const usage = await getServerResourceUsage(identifier);
        const currentState = usage.attributes?.current_state || "offline";
        const prevState = serverStateCache.get(identifier);

        // State change detected
        if (prevState !== undefined && prevState !== currentState) {
          log(`Server ${identifier} state changed: ${prevState} → ${currentState}`);

          const users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
            .from(usersTable).limit(200);

          const [sub] = await db.select({ userId: serverSubdomainsTable.userId })
            .from(serverSubdomainsTable)
            .where(eq(serverSubdomainsTable.pterodactylIdentifier, identifier))
            .limit(1);

          const owner = sub ? users.find(u => u.id === sub.userId) : null;

          if (owner) {
            if (currentState === "offline" && prevState === "running") {
              // Server went down
              const { serverDown } = emailTemplates;
              if (serverDown) {
                const tpl = serverDown(owner.name || "utilisateur", serverName);
                await sendEmail(owner.email, tpl.subject, tpl.html).catch(() => {});
              }
              await createNotification(owner.id, "server_down", `Serveur hors ligne : ${serverName}`,
                `Votre serveur "${serverName}" s'est arrêté inopinément.`,
                { serverId: identifier }
              );
            } else if (currentState === "running" && prevState === "offline") {
              // Server came back up
              const { serverUp } = emailTemplates;
              if (serverUp) {
                const tpl = serverUp(owner.name || "utilisateur", serverName);
                await sendEmail(owner.email, tpl.subject, tpl.html).catch(() => {});
              }
              await createNotification(owner.id, "server_up", `Serveur en ligne : ${serverName}`,
                `Votre serveur "${serverName}" est de nouveau en ligne.`,
                { serverId: identifier }
              );
            }
          }
        }
        serverStateCache.set(identifier, currentState);
      } catch {}
    }
  } catch (err) {
    log(`monitorServerStates error: ${err}`);
  }
}

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

// ─── Clean up expired free trial servers ──────────────────────────────────────
export async function cleanupExpiredTrials() {
  log("Checking for expired trial servers...");
  try {
    const now = new Date();
    const expired = await db.select().from(serverSubdomainsTable)
      .where(and(
        eq(serverSubdomainsTable.isTrial, true),
        lte(serverSubdomainsTable.trialExpiresAt, now)
      ));

    if (expired.length === 0) {
      log("No expired trial servers found.");
      return;
    }

    for (const trial of expired) {
      try {
        log(`Deleting expired trial server: ${trial.pterodactylIdentifier}`);

        // 1. Supprimer de Pterodactyl
        await deletePteroServer(trial.pterodactylIdentifier).catch(e =>
          log(`  Warning: Ptero delete failed for ${trial.pterodactylIdentifier}: ${e.message}`)
        );

        // 2. Supprimer de la DB
        await db.delete(serverSubdomainsTable).where(eq(serverSubdomainsTable.id, trial.id));

        // 3. Notifier l'utilisateur par email
        if (trial.userId) {
          const [user] = await db.select({ email: usersTable.email, name: usersTable.name, username: usersTable.username })
            .from(usersTable).where(eq(usersTable.id, trial.userId)).limit(1);
          if (user) {
            const displayName = user.name || user.username || "utilisateur";
            await sendEmail(user.email, "⏱️ Votre serveur d'essai FlyHost a expiré", `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#FAFAFA;padding:32px;border-radius:16px">
                <div style="font-size:28px;font-weight:800;margin-bottom:24px;color:#FACC15">FlyHost</div>
                <h2 style="color:#FAFAFA;margin-bottom:8px">Votre essai gratuit est terminé</h2>
                <p style="color:#A1A1AA;margin-bottom:16px">
                  Bonjour <strong style="color:#FAFAFA">${displayName}</strong>,
                </p>
                <p style="color:#A1A1AA;margin-bottom:16px">
                  Votre serveur d'essai gratuit de <strong style="color:#FACC15">24H</strong> vient d'expirer et a été supprimé automatiquement.
                </p>
                <p style="color:#A1A1AA;margin-bottom:24px">
                  Pour continuer à héberger vos projets, rechargez vos coins et créez un serveur permanent.
                </p>
                <a href="https://flihost.site/servers" 
                   style="display:inline-block;padding:14px 28px;background:#FACC15;color:#09090B;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px">
                  Créer un serveur
                </a>
                <p style="color:#52525B;font-size:12px;margin-top:24px">flihost.site</p>
              </div>
            `).catch(() => {});
          }
        }

        log(`  ✓ Trial server ${trial.pterodactylIdentifier} deleted`);
      } catch (e: any) {
        log(`  Error deleting trial ${trial.pterodactylIdentifier}: ${e.message}`);
      }
    }

    log(`Cleanup done: ${expired.length} trial server(s) deleted.`);
  } catch (e: any) {
    log(`Cleanup trials error: ${e.message}`);
  }
}

// ─── Start all crons ──────────────────────────────────────────────────────────
export function startCronJobs() {
  log("Starting cron jobs...");

  // Every 5 minutes: collect metrics + monitor server states
  setInterval(() => {
    collectMetrics();
    monitorServerStates();
  }, 5 * 60 * 1000);

  // Every hour: fix stuck builds + cleanup tmp + clean expired trials
  setInterval(() => {
    fixStuckBuilds();
    cleanupTmpDirs();
    processAutoRenewals();
    sendExpirationAlerts();
    cleanupExpiredTrials();
  }, 60 * 60 * 1000);

  // Every minute: restart schedules
  setInterval(processRestartSchedules, 60 * 1000);

  // Run immediately on startup
  fixStuckBuilds();
  cleanupTmpDirs();
  collectMetrics();

  log("✅ Cron jobs started");
}
