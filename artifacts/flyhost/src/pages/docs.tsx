import { useState } from "react";
import { FlyLayout } from "@/components/fly-layout";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const surfaceStrong = "rgba(28,28,35,0.97)";

const SECTIONS = [
  {
    id: "getting-started",
    icon: "🚀",
    title: "Démarrage rapide",
    content: [
      { title: "Créer un compte", body: "Rendez-vous sur flyhost.io/register et créez votre compte en 30 secondes. Vous recevrez 10 coins de bienvenue automatiquement." },
      { title: "Déployer votre premier projet", body: "Cliquez sur 'Déployer' dans le menu, choisissez une méthode (GitHub, ZIP, ou Template), configurez votre projet et lancez le déploiement." },
      { title: "Gérer vos coins", body: "Les coins sont la monnaie de FLYHOST. Vous pouvez en obtenir via l'inscription, les connexions quotidiennes, les parrainages, ou en achetant un abonnement." },
    ],
  },
  {
    id: "deployments",
    icon: "📦",
    title: "Déploiements",
    content: [
      { title: "Méthodes de déploiement", body: "FLYHOST supporte trois méthodes : depuis GitHub (importez n'importe quel repository public ou privé), via ZIP (uploadez vos fichiers), ou en utilisant nos templates préconfigurés." },
      { title: "Variables d'environnement", body: "Ajoutez vos variables d'environnement directement dans l'interface. Elles sont chiffrées et jamais exposées en clair dans les logs." },
      { title: "Domaines personnalisés", body: "Connectez votre propre domaine en ajoutant un enregistrement CNAME ou A dans votre DNS. La propagation prend généralement moins de 5 minutes." },
    ],
  },
  {
    id: "api",
    icon: "⚡",
    title: "API REST",
    content: [
      { title: "Authentification", body: "Toutes les requêtes API nécessitent un header Authorization: Bearer <token>. Obtenez votre token depuis votre profil → Clé API." },
      { title: "Endpoints principaux", body: "POST /api/auth/login — Connexion\nGET /api/projects — Liste vos projets\nPOST /api/projects — Crée un projet\nPOST /api/projects/:id/deployments — Lance un déploiement" },
      { title: "Rate limiting", body: "L'API est limitée à 100 requêtes par minute par IP. Les abonnés Pro bénéficient de 500 req/min, Business de 2000 req/min." },
    ],
  },
  {
    id: "coins",
    icon: "🪙",
    title: "Système de coins",
    content: [
      { title: "Obtenir des coins", body: "• +10 coins à l'inscription\n• +10 coins/jour de connexion\n• +50 coins par filleul\n• Bonus selon votre abonnement (100 à 1000/mois)" },
      { title: "Dépenser des coins", body: "Les coins servent à payer votre abonnement mensuel (500 à 4000 coins/mois selon le plan). Chaque plan inclut des avantages exclusifs." },
      { title: "Expiration", body: "Les coins n'expirent jamais. Votre solde est conservé indéfiniment." },
    ],
  },
  {
    id: "faq",
    icon: "❓",
    title: "FAQ",
    content: [
      { title: "Mon déploiement échoue, que faire ?", body: "Vérifiez les logs de build dans l'onglet Logs. Les erreurs courantes sont : dépendances manquantes, port incorrect (utilisez la variable PORT), ou script de build mal configuré." },
      { title: "Comment configurer mon domaine ?", body: "Dans votre projet, allez dans 'Domaines' puis 'Ajouter un domaine'. Suivez les instructions pour configurer votre DNS. Un certificat SSL est automatiquement émis." },
      { title: "Puis-je utiliser une base de données ?", body: "Oui ! Vous pouvez utiliser n'importe quelle base de données externe (PostgreSQL, MongoDB, Redis...) en passant l'URL de connexion via une variable d'environnement." },
    ],
  },
];

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");

  const section = SECTIONS.find(s => s.id === activeSection);

  return (
    <FlyLayout title="Documentation">
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>📚 Documentation</h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Tout ce dont vous avez besoin pour utiliser FLYHOST</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Sidebar */}
        <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "16px", position: "sticky", top: "80px" }}>
          <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#52525B", marginBottom: "12px", padding: "0 8px" }}>
            Sections
          </div>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px",
              borderRadius: "10px", border: "none", cursor: "pointer", fontFamily: "inherit",
              background: activeSection === s.id ? accent : "transparent",
              color: activeSection === s.id ? "#09090B" : "#A1A1AA",
              fontWeight: 600, fontSize: "14px", textAlign: "left", marginBottom: "2px",
              transition: "all 0.2s",
            }}>
              <span>{s.icon}</span> {s.title}
            </button>
          ))}

          <div style={{ marginTop: "20px", padding: "16px", background: accentDim, border: `1px solid ${border}`, borderRadius: "12px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>💬 Besoin d'aide ?</div>
            <p style={{ fontSize: "12px", color: "#71717A", marginBottom: "10px" }}>Notre équipe est disponible 7j/7</p>
            <a href="mailto:support@flyhost.io" style={{ display: "block", textAlign: "center", padding: "8px", background: accent, borderRadius: "8px", color: "#09090B", textDecoration: "none", fontSize: "12px", fontWeight: 700 }}>
              Contacter le support
            </a>
          </div>
        </div>

        {/* Content */}
        <div>
          {section && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: accentDim, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px" }}>
                  {section.icon}
                </div>
                <h2 style={{ fontSize: "28px", fontWeight: 800 }}>{section.title}</h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {section.content.map((item, i) => (
                  <div key={i} style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "24px" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: accent }}>→</span> {item.title}
                    </h3>
                    <div style={{ color: "#A1A1AA", fontSize: "14px", lineHeight: 1.8, whiteSpace: "pre-line" }}>
                      {item.body.includes("/api/") || item.body.includes("•") ? (
                        <pre style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.4)", padding: "12px 16px", borderRadius: "8px", fontSize: "13px", overflowX: "auto", whiteSpace: "pre-wrap", color: "#FAFAFA", margin: 0 }}>{item.body}</pre>
                      ) : item.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* API quick reference */}
          {activeSection === "api" && (
            <div style={{ marginTop: "24px", background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: `1px solid ${border}`, fontWeight: 800, fontSize: "16px" }}>
                🔧 Exemple de requête
              </div>
              <pre style={{ margin: 0, padding: "20px 24px", fontFamily: "monospace", fontSize: "13px", color: "#A1A1AA", overflowX: "auto", lineHeight: 1.6, background: "transparent" }}>
{`curl -X GET \\
  https://api.flyhost.io/api/projects \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json"

# Response
{
  "projects": [
    {
      "id": 1,
      "name": "mon-projet",
      "status": "active",
      "lastDeployment": "2026-03-28T14:00:00Z"
    }
  ]
}`}
              </pre>
            </div>
          )}
        </div>
      </div>
    </FlyLayout>
  );
}
