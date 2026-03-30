import nodemailer from "nodemailer";

const users = [
  { email: "admin@flyhost.site", name: "Admin FlyHost" },
  { email: "jarixpro8@gmail.com", name: "Jarix" },
  { email: "christtsotie93@gmail.com", name: "jarixo" },
  { email: "blancedsondomanyrichard@gmail.com", name: "Blanc Edson" },
  { email: "orjaimej@gmail.com", name: "Jesus" },
  { email: "christorjaime@gmail.com", name: "Christ" },
  { email: "jovof26900@onbap.com", name: "jhondoe" },
  { email: "lancesterghost@gmail.com", name: "yoshi" },
  { email: "primisdev4@gmail.com", name: "dsprimis" },
  { email: "soulky123@gmail.com", name: "soul" },
  { email: "nyebeaudrey6@gmail.com", name: "Le_Colon" },
  { email: "fokouloic537@gmail.com", name: "loic" },
  { email: "hostfly2@gmail.com", name: "lionel9b" },
  { email: "millionsonknives@gmail.com", name: "primus" },
  { email: "lionel9bc@gmail.com", name: "lionel9bc" },
  { email: "jh9364522@gmail.com", name: "James" },
  { email: "markusdarius69@gmail.com", name: "Darius" },
  { email: "volumed224@gmail.com", name: "Volumed224" },
  { email: "itzsolomon114@gmail.com", name: "Supremetech" },
  { email: "darioaziz60@gmail.com", name: "Dario123" },
  { email: "robertcorazon00@gmail.com", name: "Robert" },
  { email: "cheihkseck32@gmail.com", name: "Fallou_seck" },
  { email: "dmfdark@gmail.com", name: "Dmf" },
  { email: "blessingbadibangi2008@gmail.com", name: "Blessing" },
  { email: "blessingbadibangi4245@gmail.com", name: "blessing4245" },
  { email: "mouhamedalbachircamara@gmail.com", name: "mouhamed" },
  { email: "domoucr@gmail.com", name: "Anonyme" },
  { email: "kevnteppe@gmail.com", name: "kenv02" },
  { email: "rosineehila@gmail.com", name: "Larue237" },
  { email: "thierrysmitch2004@gmail.com", name: "EMINENCE_10" },
  { email: "onesime.christian225@gmail.com", name: "Jordan" },
  { email: "ashleyameli29@gmail.com", name: "ameliashley" },
  { email: "novarecord99@gmail.com", name: "nova" },
  { email: "godwinmaximus4@gmail.com", name: "Godwin" },
  { email: "evansndong16@gmail.com", name: "___" },
  { email: "naharou67@gmail.com", name: "harouna667" },
  { email: "musanhandi541@gmail.com", name: "jordan" },
  { email: "kuronamoretti@gmail.com", name: "klein" },
  { email: "monaban776@gmail.com", name: "Christophe12" },
  { email: "wenmagicimmortalguy@gmail.com", name: "may_carlton" },
  { email: "madrinlaporte@gmail.com", name: "moarmoush" },
  { email: "borelanzo718@gmail.com", name: "Borel" },
  { email: "condeaminata.12345@gmail.com", name: "ghost" },
  { email: "janetlucy7987@gmail.com", name: "Hantu12" },
  { email: "lolligtuyy@gmail.com", name: "farhan" },
  { email: "muzantech1@gmail.com", name: "muzan" },
  { email: "phantomluxe0@gmail.com", name: "given1" },
  { email: "Curtis23@gmail.com", name: "Curtis" },
  { email: "jordanfotso240@gmail.com", name: "Jordan2020" },
  { email: "niakekelesagesse@gmail.com", name: "niakekele" },
  { email: "bookmakerp@gmail.com", name: "Kerm" },
  { email: "luisrojas30921@gmail.com", name: "Sebasmod" },
  { email: "matsunochifuyuaogiri@gmail.com", name: "Markus" },
  { email: "moudychyeng@gmail.com", name: "chyeng" },
  { email: "pascalakli25@gmail.com", name: "Mr_tiger" },
  { email: "lajoba2703@toneke.com", name: "vdzTech" },
  { email: "martaaromano0@gmail.com", name: "kenisawadev" },
  { email: "arsendarlingjustus05@gmail.com", name: "Mr_Right" },
  { email: "luckdigitaltechnologie@gmail.com", name: "MrRight475" },
  { email: "goodfreefire509@gmail.com", name: "faketech" },
  { email: "pustiktok6@gmail.com", name: "OnlyNar77" },
  { email: "smitchthierry@gmail.com", name: "Eminence2" },
  { email: "saanohlux6@gmail.com", name: "noxprimeeee" },
  { email: "biloaphilemon@gmail.com", name: "biloaphilemon" },
  { email: "mzock758@gmail.com", name: "Johndoe12" },
  { email: "milfortmarcandy2008@gmail.com", name: "mpdymtoowyll" },
  { email: "blackfamily320@gmail.com", name: "blackfamily" },
  { email: "kunz_misse@yahoo.com", name: "hackeur" },
  { email: "alexandrejesula98@gmail.com", name: "1234567890" },
  { email: "miguelking2377@gmail.com", name: "Miguel" },
  { email: "tmahamane805@gmail.com", name: "Moht805" },
  { email: "oc5105611@gmail.com", name: "Aza" },
  { email: "fredericminkoulou06@gmail.com", name: "Arkhacorvus" },
  { email: "christraoulekoelerroy7@gmail.com", name: "Christraoul" },
  { email: "kensenhonore@gmail.com", name: "abyss" },
  { email: "yoanemackita0@gmail.com", name: "yoane1234" },
  { email: "bachiraamirata@gmail.com", name: "Rue237" },
  { email: "yhrespon@gmail.com", name: "nozen" },
  { email: "maboundoumalachi@gmail.com", name: "Dark" },
  { email: "muzansigma6@gmail.com", name: "Sigmapro" },
  { email: "amarutech0@gmail.com", name: "AMARU TECH" },
];

function htmlEmail(name) {
  const displayName = name || "cher utilisateur";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FlyHost — Nouvelles fonctionnalités</title>
</head>
<body style="margin:0;padding:0;background:#09090B;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090B;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">

        <tr><td style="background:linear-gradient(135deg,#18181B 0%,#1C1C20 100%);border-radius:20px 20px 0 0;padding:36px 40px;border:1px solid #27272A;border-bottom:none;text-align:center;">
          <div style="display:inline-block;background:#FACC15;color:#09090B;font-weight:900;font-size:22px;padding:8px 20px;border-radius:10px;letter-spacing:1px;">✈ FlyHost</div>
          <p style="margin:16px 0 0 0;color:#A1A1AA;font-size:13px;">La plateforme d'hébergement pensée pour l'Afrique</p>
        </td></tr>

        <tr><td style="background:#18181B;padding:36px 40px;border:1px solid #27272A;border-top:none;border-bottom:none;">
          <p style="color:#E4E4E7;font-size:16px;margin:0 0 8px 0;">Bonjour <strong style="color:#FACC15;">${displayName}</strong> 👋</p>
          <p style="color:#A1A1AA;font-size:14px;line-height:1.7;margin:0 0 28px 0;">L'équipe FlyHost a travaillé dur ce mois-ci. Voici ce qui est maintenant disponible sur ta plateforme :</p>

          <div style="background:#1C1C20;border-radius:14px;padding:20px 22px;margin-bottom:16px;border-left:3px solid #FACC15;">
            <div style="font-size:20px;margin-bottom:6px;">✨</div>
            <div style="color:#FACC15;font-size:14px;font-weight:700;margin-bottom:6px;">FlyBot — Assistant IA intégré</div>
            <div style="color:#A1A1AA;font-size:13px;line-height:1.6;">FlyBot est présent partout : il <strong style="color:#E4E4E7;">génère automatiquement ta configuration</strong> (commande de démarrage, variables d'environnement), analyse tes erreurs de déploiement et t'explique les logs en français. Plus besoin de chercher sur Google.</div>
          </div>

          <div style="background:#1C1C20;border-radius:14px;padding:20px 22px;margin-bottom:16px;border-left:3px solid #10B981;">
            <div style="font-size:20px;margin-bottom:6px;">🔧</div>
            <div style="color:#10B981;font-size:14px;font-weight:700;margin-bottom:6px;">Éditeur de code avec IA</div>
            <div style="color:#A1A1AA;font-size:13px;line-height:1.6;">L'éditeur intègre maintenant 3 actions IA : <strong style="color:#E4E4E7;">Expliquer, Corriger et Améliorer</strong> ton code en un clic. Idéal pour déboguer rapidement sans quitter l'interface.</div>
          </div>

          <div style="background:#1C1C20;border-radius:14px;padding:20px 22px;margin-bottom:28px;border-left:3px solid #6366F1;">
            <div style="font-size:20px;margin-bottom:6px;">📦</div>
            <div style="color:#6366F1;font-size:14px;font-weight:700;margin-bottom:6px;">Variables d'environnement auto-générées</div>
            <div style="color:#A1A1AA;font-size:13px;line-height:1.6;">FlyBot analyse le type de ton application et propose les variables essentielles avec un bouton <strong style="color:#E4E4E7;">"Ajouter"</strong> pour les injecter en un clic dans ton déploiement.</div>
          </div>

          <div style="background:linear-gradient(135deg,#1A1A10 0%,#1C1A0A 100%);border:1.5px solid rgba(250,204,21,0.3);border-radius:16px;padding:28px;text-align:center;margin-bottom:28px;">
            <div style="font-size:28px;margin-bottom:12px;">🚀</div>
            <div style="color:#FACC15;font-size:18px;font-weight:800;margin-bottom:10px;">Passe à la vitesse supérieure</div>
            <div style="color:#A1A1AA;font-size:13px;line-height:1.7;margin-bottom:20px;">
              Héberge tes projets sans limite sur nos serveurs haute performance.<br>
              <strong style="color:#E4E4E7;">Minecraft, bots Discord, sites web, APIs, bases de données</strong> — tout est possible.<br><br>
              Des plans accessibles conçus pour le marché africain. Lance-toi dès aujourd'hui.
            </div>
            <a href="https://flihost.site/dashboard" style="display:inline-block;background:#FACC15;color:#09090B;font-weight:800;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;">Créer mon serveur maintenant →</a>
          </div>

          <div style="border-top:1px solid #27272A;padding-top:20px;">
            <p style="color:#52525B;font-size:12px;text-align:center;line-height:1.6;margin:0;">
              💬 <em>"FlyHost m'a permis de déployer mon bot en moins de 5 minutes, FlyBot a même détecté mon erreur automatiquement."</em><br>
              <span style="color:#3F3F46;">— Un utilisateur FlyHost</span>
            </p>
          </div>
        </td></tr>

        <tr><td style="background:#111113;border-radius:0 0 20px 20px;padding:24px 40px;border:1px solid #27272A;border-top:none;text-align:center;">
          <div style="color:#FACC15;font-weight:800;font-size:14px;margin-bottom:6px;">✈ FlyHost</div>
          <div style="color:#52525B;font-size:12px;line-height:1.6;">
            <a href="https://flihost.site" style="color:#FACC15;text-decoration:none;">flihost.site</a> · support@flyhost.site<br>
            Tu reçois cet email car tu es inscrit sur FlyHost.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

await transporter.verify();
console.log("✅ Connexion SMTP OK — Début de l'envoi...\n");

let sent = 0, errors = 0;

for (const user of users) {
  try {
    await transporter.sendMail({
      from: `"FlyHost" <${process.env.SMTP_FROM}>`,
      to: user.email,
      subject: "✨ FlyHost — FlyBot est là, ton hébergement n'a jamais été aussi simple",
      html: htmlEmail(user.name),
    });
    sent++;
    console.log(`[${sent}/${users.length}] ✅ ${user.email}`);
    await new Promise(r => setTimeout(r, 350));
  } catch (e) {
    errors++;
    console.log(`[ERR] ❌ ${user.email} — ${e.message}`);
  }
}

console.log(`\n📊 Résultat final : ${sent} envoyés ✅  |  ${errors} erreurs ❌`);
