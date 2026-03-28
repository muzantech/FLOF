import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("[mailer] SMTP not configured, skipping email to", to);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"FlyHost" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("[mailer] Failed to send email:", err);
  }
}

export async function sendDiscordWebhook(webhookUrl: string, content: string, embeds?: object[]): Promise<void> {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, embeds }),
    });
  } catch (err) {
    console.error("[discord] webhook failed:", err);
  }
}

export async function sendTelegram(chatId: string, message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error("[telegram] failed:", err);
  }
}

// Email templates
export const emailTemplates = {
  serverExpiring: (serverName: string, daysLeft: number) => ({
    subject: `⚠️ Votre serveur "${serverName}" expire dans ${daysLeft} jour(s)`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#FAFAFA;padding:32px;border-radius:16px">
        <div style="font-size:28px;font-weight:800;margin-bottom:8px;color:#FACC15">FlyHost</div>
        <h2 style="color:#ef4444">⚠️ Serveur bientôt expiré</h2>
        <p>Votre serveur <strong>${serverName}</strong> expire dans <strong>${daysLeft} jour(s)</strong>.</p>
        <p>Rechargez vos coins et activez le renouvellement automatique pour éviter la suspension.</p>
        <a href="${process.env.APP_URL || "https://flihost.site"}/servers" 
           style="display:inline-block;padding:12px 24px;background:#FACC15;color:#09090B;text-decoration:none;border-radius:8px;font-weight:700;margin-top:16px">
          Gérer mes serveurs
        </a>
      </div>
    `,
  }),

  serverDeleted: (serverName: string) => ({
    subject: `🗑️ Serveur "${serverName}" supprimé`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#FAFAFA;padding:32px;border-radius:16px">
        <div style="font-size:28px;font-weight:800;margin-bottom:8px;color:#FACC15">FlyHost</div>
        <h2 style="color:#ef4444">Serveur supprimé</h2>
        <p>Votre serveur <strong>${serverName}</strong> a été supprimé automatiquement suite à son expiration.</p>
        <a href="${process.env.APP_URL || "https://flihost.site"}/servers/new" 
           style="display:inline-block;padding:12px 24px;background:#FACC15;color:#09090B;text-decoration:none;border-radius:8px;font-weight:700;margin-top:16px">
          Créer un nouveau serveur
        </a>
      </div>
    `,
  }),

  renewalSuccess: (serverName: string, coinsUsed: number) => ({
    subject: `✅ Serveur "${serverName}" renouvelé`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#FAFAFA;padding:32px;border-radius:16px">
        <div style="font-size:28px;font-weight:800;margin-bottom:8px;color:#FACC15">FlyHost</div>
        <h2 style="color:#10b981">✅ Renouvellement automatique réussi</h2>
        <p>Votre serveur <strong>${serverName}</strong> a été renouvelé pour 30 jours supplémentaires.</p>
        <p><strong>${coinsUsed} coins</strong> ont été déduits de votre solde.</p>
      </div>
    `,
  }),

  renewalFailed: (serverName: string, coinsNeeded: number) => ({
    subject: `❌ Renouvellement échoué — "${serverName}"`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#FAFAFA;padding:32px;border-radius:16px">
        <div style="font-size:28px;font-weight:800;margin-bottom:8px;color:#FACC15">FlyHost</div>
        <h2 style="color:#ef4444">❌ Renouvellement échoué</h2>
        <p>Nous n'avons pas pu renouveler <strong>${serverName}</strong>.</p>
        <p>Il vous faut <strong>${coinsNeeded} coins</strong> — rechargez votre solde maintenant.</p>
        <a href="${process.env.APP_URL || "https://flihost.site"}/coins" 
           style="display:inline-block;padding:12px 24px;background:#FACC15;color:#09090B;text-decoration:none;border-radius:8px;font-weight:700;margin-top:16px">
          Recharger mes coins
        </a>
      </div>
    `,
  }),

  cpuAlert: (serverName: string, cpu: number) => ({
    subject: `🔥 Alerte CPU — ${serverName} à ${cpu.toFixed(1)}%`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#FAFAFA;padding:32px;border-radius:16px">
        <div style="font-size:28px;font-weight:800;margin-bottom:8px;color:#FACC15">FlyHost</div>
        <h2 style="color:#f59e0b">🔥 Alerte CPU élevé</h2>
        <p>Le serveur <strong>${serverName}</strong> utilise <strong>${cpu.toFixed(1)}%</strong> du CPU.</p>
        <p>Envisagez de redémarrer le serveur ou de passer à un plan supérieur.</p>
      </div>
    `,
  }),
};
