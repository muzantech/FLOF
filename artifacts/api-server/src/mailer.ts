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

  verificationEmail: (name: string, code: string) => ({
    subject: `🔐 Vérifiez votre adresse email — FlyHost`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#FAFAFA;padding:32px;border-radius:16px">
        <div style="font-size:28px;font-weight:800;margin-bottom:24px;color:#FACC15">FlyHost</div>
        <h2 style="color:#FAFAFA;margin-bottom:8px">Vérifiez votre adresse email</h2>
        <p style="color:#A1A1AA;margin-bottom:24px">Bonjour <strong style="color:#FAFAFA">${name}</strong>, utilisez ce code pour confirmer votre adresse email :</p>
        <div style="background:#18181B;border:1px solid #3F3F46;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#FACC15;font-family:monospace">${code}</div>
          <div style="color:#71717A;font-size:13px;margin-top:8px">Ce code expire dans <strong>15 minutes</strong></div>
        </div>
        <p style="color:#71717A;font-size:13px">Si vous n'avez pas créé de compte sur FlyHost, ignorez cet email.</p>
      </div>
    `,
  }),

  resetPasswordEmail: (name: string, code: string) => ({
    subject: `🔑 Réinitialisez votre mot de passe — FlyHost`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#09090B;color:#FAFAFA;padding:32px;border-radius:16px">
        <div style="font-size:28px;font-weight:800;margin-bottom:24px;color:#FACC15">FlyHost</div>
        <h2 style="color:#FAFAFA;margin-bottom:8px">Réinitialisation de mot de passe</h2>
        <p style="color:#A1A1AA;margin-bottom:24px">Bonjour <strong style="color:#FAFAFA">${name}</strong>, utilisez ce code pour réinitialiser votre mot de passe :</p>
        <div style="background:#18181B;border:1px solid #3F3F46;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#FACC15;font-family:monospace">${code}</div>
          <div style="color:#71717A;font-size:13px;margin-top:8px">Ce code expire dans <strong>15 minutes</strong></div>
        </div>
        <p style="color:#71717A;font-size:13px">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe ne sera pas modifié.</p>
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

  welcomeEmail: (name: string, username: string, coins: number) => ({
    subject: `🚀 Bienvenue sur FlyHost, ${name.split(" ")[0]} !`,
    html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
      <body style="margin:0;padding:0;background:#0a0a0b;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0a0a0b;padding:40px 16px">
          <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px">

              <!-- Header -->
              <tr><td style="background:#09090B;border-radius:16px 16px 0 0;padding:32px;text-align:center;border-bottom:1px solid #1f1f1f">
                <div style="display:inline-flex;align-items:center;gap:10px">
                  <div style="width:36px;height:36px;background:#FACC15;border-radius:10px;display:inline-flex;align-items:center;justify-content:center">
                    <span style="font-size:20px">▲</span>
                  </div>
                  <span style="font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.5px">FlyHost</span>
                </div>
              </td></tr>

              <!-- Body -->
              <tr><td style="background:#09090B;padding:40px 32px">
                <h1 style="color:#FFFFFF;font-size:26px;font-weight:800;margin:0 0 12px">
                  Bienvenue, ${name.split(" ")[0]} ! 🎉
                </h1>
                <p style="color:#A1A1AA;font-size:15px;line-height:1.6;margin:0 0 28px">
                  Votre compte <strong style="color:#FFFFFF">@${username}</strong> est activé. Vous pouvez maintenant déployer vos applications et créer des serveurs en quelques secondes.
                </p>

                <!-- Coins bonus banner -->
                <div style="background:#1a1a0a;border:1px solid #3a3000;border-radius:12px;padding:20px 24px;margin:0 0 28px;text-align:center">
                  <div style="font-size:32px;font-weight:900;color:#FACC15;letter-spacing:-1px">${coins} coins</div>
                  <div style="color:#92883a;font-size:13px;margin-top:4px">offerts sur votre compte 🎁</div>
                </div>

                <!-- What you can do -->
                <h3 style="color:#FFFFFF;font-size:15px;font-weight:700;margin:0 0 16px">Ce que vous pouvez faire :</h3>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px">
                  ${[
                    ["🚀", "Déployer un serveur Node.js, Python, PHP, Minecraft", "/servers/new"],
                    ["💰", "Recharger des coins avec Orange Money ou Wave", "/subscription"],
                    ["🎁", "Inviter des amis et gagner +20 coins par filleul", "/referral"],
                    ["📊", "Suivre vos projets depuis le dashboard", "/dashboard"],
                  ].map(([icon, text, _link]) => `
                    <tr>
                      <td style="padding:8px 0;vertical-align:top">
                        <span style="font-size:18px;margin-right:12px">${icon}</span>
                        <span style="color:#D4D4D8;font-size:14px">${text}</span>
                      </td>
                    </tr>
                  `).join("")}
                </table>

                <!-- CTA -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr><td align="center">
                    <a href="${process.env.APP_URL || "https://flihost.site"}/dashboard"
                       style="display:inline-block;padding:14px 36px;background:#FACC15;color:#09090B;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px;letter-spacing:-0.2px">
                      Accéder à mon dashboard →
                    </a>
                  </td></tr>
                </table>
              </td></tr>

              <!-- Quick links -->
              <tr><td style="background:#0f0f0f;padding:24px 32px;border-top:1px solid #1a1a1a">
                <p style="color:#52525B;font-size:12px;margin:0 0 12px;text-align:center">Liens utiles</p>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    ${[["Documentation", "/docs"], ["Support WhatsApp", "https://wa.me/22300000000"], ["Tarifs", "/pricing"]].map(([label, href]) => `
                      <td align="center">
                        <a href="${href.startsWith("http") ? href : (process.env.APP_URL || "https://flihost.site") + href}"
                           style="color:#FACC15;text-decoration:none;font-size:13px;font-weight:600">${label}</a>
                      </td>
                    `).join("")}
                  </tr>
                </table>
              </td></tr>

              <!-- Footer -->
              <tr><td style="background:#09090B;border-radius:0 0 16px 16px;padding:24px 32px;border-top:1px solid #1a1a1a;text-align:center">
                <p style="color:#3F3F46;font-size:12px;margin:0">
                  © 2026 FlyHost · <a href="${process.env.APP_URL || "https://flihost.site"}" style="color:#52525B;text-decoration:none">flihost.site</a>
                  · Hébergement cloud pour l'Afrique francophone
                </p>
              </td></tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `,
  }),

  campaignPromo: (name: string, title: string, body: string, ctaLabel: string, ctaUrl: string) => ({
    subject: `🎉 ${title} — FlyHost`,
    html: `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',sans-serif">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#000;padding:32px 0">
          <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%">
              <tr><td style="background:#09090B;border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid #1a1a1a">
                <div style="font-size:26px;font-weight:800;color:#FACC15;letter-spacing:-0.5px">FlyHost ✦</div>
              </td></tr>
              <tr><td style="background:linear-gradient(135deg,#1a0a00,#09090B);padding:40px 36px;border:1px solid #2a1a00">
                <div style="display:inline-block;background:#FACC15;color:#09090B;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px">🎉 Promotion</div>
                <h1 style="color:#FAFAFA;font-size:26px;font-weight:800;margin:0 0 16px;line-height:1.2">${title}</h1>
                <p style="color:#A1A1AA;margin:0 0 8px">Bonjour <strong style="color:#FAFAFA">${name}</strong>,</p>
                <div style="color:#D4D4D8;font-size:15px;line-height:1.7;margin:16px 0 32px;white-space:pre-wrap">${body}</div>
                <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;background:#FACC15;color:#09090B;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px">${ctaLabel} →</a>
              </td></tr>
              <tr><td style="background:#09090B;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;border-top:1px solid #1a1a1a">
                <p style="color:#3F3F46;font-size:12px;margin:0">© 2026 FlyHost · <a href="https://flihost.site" style="color:#52525B;text-decoration:none">flihost.site</a></p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  }),

  campaignAnnouncement: (name: string, title: string, body: string) => ({
    subject: `📢 ${title} — FlyHost`,
    html: `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',sans-serif">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#000;padding:32px 0">
          <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%">
              <tr><td style="background:#09090B;border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid #1a1a1a">
                <div style="font-size:26px;font-weight:800;color:#FACC15;letter-spacing:-0.5px">FlyHost ✦</div>
              </td></tr>
              <tr><td style="background:#09090B;padding:40px 36px;border:1px solid #18181B">
                <div style="display:inline-block;background:#3B82F6;color:#fff;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px">📢 Annonce</div>
                <h1 style="color:#FAFAFA;font-size:26px;font-weight:800;margin:0 0 16px;line-height:1.2">${title}</h1>
                <p style="color:#A1A1AA;margin:0 0 8px">Bonjour <strong style="color:#FAFAFA">${name}</strong>,</p>
                <div style="color:#D4D4D8;font-size:15px;line-height:1.7;margin:16px 0 32px;white-space:pre-wrap">${body}</div>
                <a href="https://flihost.site/dashboard" style="display:inline-block;padding:12px 28px;background:#18181B;color:#FAFAFA;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px;border:1px solid #3F3F46">Accéder à la plateforme →</a>
              </td></tr>
              <tr><td style="background:#09090B;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;border-top:1px solid #1a1a1a">
                <p style="color:#3F3F46;font-size:12px;margin:0">© 2026 FlyHost · <a href="https://flihost.site" style="color:#52525B;text-decoration:none">flihost.site</a></p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  }),

  campaignAd: (name: string, title: string, body: string, ctaLabel: string, ctaUrl: string) => ({
    subject: `✨ ${title} — FlyHost`,
    html: `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',sans-serif">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#000;padding:32px 0">
          <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%">
              <tr><td style="background:linear-gradient(135deg,#0a0a1a,#09090B);border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid #1a1a1a">
                <div style="font-size:26px;font-weight:800;color:#FACC15;letter-spacing:-0.5px">FlyHost ✦</div>
              </td></tr>
              <tr><td style="background:linear-gradient(135deg,#0a0a1a,#09090B);padding:40px 36px;border:1px solid #1a1a2a">
                <div style="display:inline-block;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;padding:4px 14px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px">✨ Offre spéciale</div>
                <h1 style="color:#FAFAFA;font-size:26px;font-weight:800;margin:0 0 16px;line-height:1.2">${title}</h1>
                <p style="color:#A1A1AA;margin:0 0 8px">Bonjour <strong style="color:#FAFAFA">${name}</strong>,</p>
                <div style="color:#D4D4D8;font-size:15px;line-height:1.7;margin:16px 0 32px;white-space:pre-wrap">${body}</div>
                <a href="${ctaUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#FACC15,#F59E0B);color:#09090B;text-decoration:none;border-radius:10px;font-weight:800;font-size:15px">${ctaLabel} →</a>
              </td></tr>
              <tr><td style="background:#09090B;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;border-top:1px solid #1a1a1a">
                <p style="color:#3F3F46;font-size:12px;margin:0">© 2026 FlyHost · <a href="https://flihost.site" style="color:#52525B;text-decoration:none">flihost.site</a></p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  }),

  campaignCustom: (name: string, subject: string, body: string) => ({
    subject,
    html: `
      <!DOCTYPE html>
      <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#000;font-family:'Helvetica Neue',sans-serif">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#000;padding:32px 0">
          <tr><td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%">
              <tr><td style="background:#09090B;border-radius:16px 16px 0 0;padding:32px 36px;border-bottom:1px solid #1a1a1a">
                <div style="font-size:26px;font-weight:800;color:#FACC15;letter-spacing:-0.5px">FlyHost ✦</div>
              </td></tr>
              <tr><td style="background:#09090B;padding:40px 36px;border:1px solid #18181B">
                <p style="color:#A1A1AA;margin:0 0 8px">Bonjour <strong style="color:#FAFAFA">${name}</strong>,</p>
                <div style="color:#D4D4D8;font-size:15px;line-height:1.7;margin:16px 0;white-space:pre-wrap">${body}</div>
              </td></tr>
              <tr><td style="background:#09090B;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;border-top:1px solid #1a1a1a">
                <p style="color:#3F3F46;font-size:12px;margin:0">© 2026 FlyHost · <a href="https://flihost.site" style="color:#52525B;text-decoration:none">flihost.site</a></p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  }),
};
