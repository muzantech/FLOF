import { useState } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { ArrowRight, Zap } from "lucide-react";

const Y = "#FACC15";
const Bg = "#09090B";
const Card = "rgba(28,28,32,0.98)";
const Border = "rgba(255,255,255,0.07)";
const Muted = "#71717A";

interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  type: string;
  tags: string[];
  startCommand: string;
  envVars: { key: string; placeholder: string; description: string }[];
  tip: string;
  color: string;
}

const TEMPLATES: Template[] = [
  {
    id: "discord-bot-js",
    name: "Bot Discord (Node.js)",
    icon: "🤖",
    description: "Bot Discord complet avec discord.js. Gestion des commandes slash, événements et intégrations.",
    type: "nodejs",
    tags: ["Discord", "Node.js", "Bot"],
    startCommand: "node index.js",
    envVars: [
      { key: "DISCORD_TOKEN", placeholder: "ton-token-bot", description: "Token de ton bot Discord" },
      { key: "CLIENT_ID", placeholder: "1234567890", description: "ID de l'application Discord" },
      { key: "GUILD_ID", placeholder: "9876543210", description: "ID du serveur (optionnel pour les commandes globales)" },
      { key: "NODE_ENV", placeholder: "production", description: "Environnement d'exécution" },
    ],
    tip: "Génère ton token sur discord.com/developers/applications. Active les intents 'Server Members' et 'Message Content' si nécessaire.",
    color: "#5865F2",
  },
  {
    id: "express-api",
    name: "API Express (Node.js)",
    icon: "⚡",
    description: "API REST rapide avec Express.js. Parfait pour les backends de mobile apps ou SPA.",
    type: "nodejs",
    tags: ["Node.js", "API", "REST"],
    startCommand: "node server.js",
    envVars: [
      { key: "PORT", placeholder: "3000", description: "Port d'écoute du serveur" },
      { key: "NODE_ENV", placeholder: "production", description: "Environnement d'exécution" },
      { key: "DATABASE_URL", placeholder: "postgresql://user:pass@host:5432/db", description: "URL de connexion à la base de données" },
      { key: "JWT_SECRET", placeholder: "un-secret-long-et-complexe", description: "Clé secrète pour les tokens JWT" },
      { key: "CORS_ORIGIN", placeholder: "https://ton-site.com", description: "Origine autorisée pour CORS" },
    ],
    tip: "Utilise `process.env.PORT` dans ton code — FlyHost assigne le port automatiquement.",
    color: "#10B981",
  },
  {
    id: "nextjs-app",
    name: "Application Next.js",
    icon: "▲",
    description: "App React full-stack avec Next.js. SSR, API routes, et déploiement optimisé.",
    type: "nodejs",
    tags: ["Next.js", "React", "SSR"],
    startCommand: "node .next/standalone/server.js",
    envVars: [
      { key: "PORT", placeholder: "3000", description: "Port d'écoute" },
      { key: "NODE_ENV", placeholder: "production", description: "Environnement" },
      { key: "NEXTAUTH_SECRET", placeholder: "un-secret-auth", description: "Secret pour NextAuth.js" },
      { key: "NEXTAUTH_URL", placeholder: "https://ton-app.flihost.site", description: "URL publique de l'application" },
      { key: "DATABASE_URL", placeholder: "postgresql://...", description: "Base de données" },
    ],
    tip: "Ajoute `output: 'standalone'` dans next.config.js pour générer un build standalone. La commande de démarrage sera dans `.next/standalone/server.js`.",
    color: "#FFFFFF",
  },
  {
    id: "fastapi",
    name: "API FastAPI (Python)",
    icon: "🐍",
    description: "API REST haute performance avec FastAPI. Auto-documentation Swagger intégrée.",
    type: "python",
    tags: ["Python", "FastAPI", "API"],
    startCommand: "uvicorn main:app --host 0.0.0.0 --port 3000",
    envVars: [
      { key: "PORT", placeholder: "3000", description: "Port d'écoute" },
      { key: "DATABASE_URL", placeholder: "postgresql://...", description: "URL base de données" },
      { key: "SECRET_KEY", placeholder: "un-secret-complexe", description: "Clé secrète pour l'authentification" },
      { key: "ALLOWED_ORIGINS", placeholder: "https://ton-site.com", description: "Origines CORS autorisées" },
    ],
    tip: "Installe les dépendances avec `pip install -r requirements.txt`. Assure-toi que uvicorn est dans ton requirements.txt.",
    color: "#06B6D4",
  },
  {
    id: "minecraft-paper",
    name: "Serveur Minecraft Paper",
    icon: "⛏️",
    description: "Serveur Minecraft Paper haute performance avec support des plugins Bukkit/Spigot.",
    type: "paper-mc",
    tags: ["Minecraft", "Paper", "Gaming"],
    startCommand: "java -Xms512M -Xmx1024M -jar paper.jar nogui",
    envVars: [
      { key: "MINECRAFT_VERSION", placeholder: "1.20.4", description: "Version de Minecraft" },
      { key: "MAX_PLAYERS", placeholder: "20", description: "Nombre max de joueurs" },
      { key: "DIFFICULTY", placeholder: "normal", description: "Difficulté (peaceful/easy/normal/hard)" },
      { key: "MOTD", placeholder: "Mon serveur FlyHost", description: "Message affiché dans la liste des serveurs" },
    ],
    tip: "Accepte l'EULA en créant un fichier `eula.txt` contenant `eula=true`. Démarre avec `nogui` pour économiser de la RAM.",
    color: "#78C850",
  },
  {
    id: "discord-bot-py",
    name: "Bot Discord (Python)",
    icon: "🐢",
    description: "Bot Discord avec discord.py. Commandes préfixées et slash commands, événements async.",
    type: "python",
    tags: ["Discord", "Python", "Bot"],
    startCommand: "python bot.py",
    envVars: [
      { key: "DISCORD_TOKEN", placeholder: "ton-token-bot", description: "Token de ton bot Discord" },
      { key: "PREFIX", placeholder: "!", description: "Préfixe des commandes (ex: !help)" },
      { key: "OWNER_ID", placeholder: "ton-discord-id", description: "ID Discord du propriétaire du bot" },
    ],
    tip: "discord.py nécessite Python 3.8+. Installe avec `pip install discord.py`. Pour les slash commands, utilise `discord.app_commands`.",
    color: "#5865F2",
  },
  {
    id: "strapi-cms",
    name: "CMS Strapi",
    icon: "📝",
    description: "CMS headless Strapi avec API REST et GraphQL. Gestion de contenu pour ton frontend.",
    type: "nodejs",
    tags: ["Node.js", "CMS", "Strapi"],
    startCommand: "npm run start",
    envVars: [
      { key: "NODE_ENV", placeholder: "production", description: "Environnement" },
      { key: "DATABASE_URL", placeholder: "postgresql://...", description: "Base de données PostgreSQL" },
      { key: "APP_KEYS", placeholder: "clé1,clé2,clé3,clé4", description: "Clés secrètes de l'app (4 valeurs séparées par virgules)" },
      { key: "API_TOKEN_SALT", placeholder: "un-salt-aléatoire", description: "Salt pour les tokens API" },
      { key: "ADMIN_JWT_SECRET", placeholder: "un-secret-admin", description: "Secret JWT pour le panel admin" },
      { key: "JWT_SECRET", placeholder: "un-secret-jwt", description: "Secret JWT pour l'API" },
    ],
    tip: "Lance `npm run build` avant `npm run start` en production. L'admin Strapi est accessible à `/admin`.",
    color: "#8B5CF6",
  },
  {
    id: "flask-app",
    name: "Application Flask (Python)",
    icon: "🌶️",
    description: "App web Python légère avec Flask. Idéal pour les dashboards, bots web et prototypes.",
    type: "python",
    tags: ["Python", "Flask", "Web"],
    startCommand: "gunicorn -w 2 -b 0.0.0.0:3000 app:app",
    envVars: [
      { key: "FLASK_ENV", placeholder: "production", description: "Environnement Flask" },
      { key: "SECRET_KEY", placeholder: "un-secret-flask", description: "Clé secrète Flask pour les sessions" },
      { key: "DATABASE_URL", placeholder: "postgresql://...", description: "URL base de données" },
      { key: "PORT", placeholder: "3000", description: "Port d'écoute" },
    ],
    tip: "Installe gunicorn avec `pip install gunicorn`. Crée un `requirements.txt` avec toutes tes dépendances.",
    color: "#EF4444",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Node.js": "#10B981",
  "Python": "#06B6D4",
  "Minecraft": "#78C850",
  "Discord": "#5865F2",
  "API": "#F59E0B",
  "Bot": "#A78BFA",
  "Gaming": "#EF4444",
  "SSR": "#FFFFFF",
  "CMS": "#8B5CF6",
};

export default function TemplatesPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const allTags = Array.from(new Set(TEMPLATES.flatMap(t => t.tags)));
  const filtered = TEMPLATES.filter(t => {
    if (selectedTag && !t.tags.includes(selectedTag)) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function useTemplate(t: Template) {
    const params = new URLSearchParams({
      templateType: t.type,
      templateName: t.name,
      templateStart: t.startCommand,
      templateEnv: JSON.stringify(t.envVars.map(v => ({ key: v.key, value: "" }))),
    });
    navigate(`/deploy?${params.toString()}`);
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <Zap style={{ width: "20px", height: "20px", color: Y }} />
            <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", margin: 0 }}>Templates One-Click</h1>
          </div>
          <p style={{ color: Muted, fontSize: "14px", margin: 0 }}>
            Déploie ton application en quelques secondes avec une configuration pré-remplie par FlyHost.
          </p>
        </div>

        {/* Search + tags */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un template…"
            style={{ flex: "1", minWidth: "200px", padding: "9px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            <button
              onClick={() => setSelectedTag(null)}
              style={{ padding: "5px 12px", borderRadius: "20px", border: `1px solid ${!selectedTag ? Y : "rgba(255,255,255,0.1)"}`, background: !selectedTag ? "rgba(250,204,21,0.12)" : "transparent", color: !selectedTag ? Y : Muted, fontSize: "12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
            >Tous</button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                style={{ padding: "5px 12px", borderRadius: "20px", border: `1px solid ${tag === selectedTag ? (CATEGORY_COLORS[tag] || Y) : "rgba(255,255,255,0.1)"}`, background: tag === selectedTag ? `${CATEGORY_COLORS[tag] || Y}18` : "transparent", color: tag === selectedTag ? (CATEGORY_COLORS[tag] || Y) : Muted, fontSize: "12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
              >{tag}</button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
          {filtered.map(t => (
            <div
              key={t.id}
              style={{ background: Card, border: `1px solid ${Border}`, borderRadius: "16px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${t.color}40`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = Border)}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ fontSize: "28px", flexShrink: 0, lineHeight: 1 }}>{t.icon}</div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff" }}>{t.name}</div>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                    {t.tags.map(tag => (
                      <span key={tag} style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "4px", background: `${CATEGORY_COLORS[tag] || Y}18`, color: CATEGORY_COLORS[tag] || Y, fontWeight: 600 }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "#A1A1AA", lineHeight: "1.5", margin: 0, flex: 1 }}>{t.description}</p>

              <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "8px", padding: "8px 10px" }}>
                <div style={{ fontSize: "10px", color: Muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>Commande de démarrage</div>
                <code style={{ fontSize: "11px", color: "#10B981", fontFamily: "monospace" }}>{t.startCommand}</code>
              </div>

              <div style={{ fontSize: "11px", color: "#A1A1AA" }}>
                <span style={{ color: Muted }}>{t.envVars.length} variables d'env</span>
              </div>

              <div style={{ background: `${t.color}10`, border: `1px solid ${t.color}25`, borderRadius: "8px", padding: "7px 10px" }}>
                <p style={{ fontSize: "11px", color: "#A1A1AA", margin: 0, lineHeight: "1.5" }}>
                  💡 {t.tip.length > 100 ? t.tip.slice(0, 100) + "…" : t.tip}
                </p>
              </div>

              <button
                onClick={() => useTemplate(t)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "10px", background: Y, border: "none", borderRadius: "10px", color: Bg, fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                Utiliser ce template <ArrowRight style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: Muted }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🔍</div>
            <p style={{ fontSize: "15px" }}>Aucun template trouvé pour « {search} »</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
