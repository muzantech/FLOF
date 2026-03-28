import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { FlyLayout } from "@/components/fly-layout";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const error = "#ef4444";
const warning = "#f59e0b";
const surfaceStrong = "rgba(28,28,35,0.97)";

const TEMPLATES = [
  { id: "nodejs", icon: "🟢", label: "Node.js" },
  { id: "python", icon: "🐍", label: "Python" },
  { id: "php", icon: "🐘", label: "PHP" },
  { id: "java", icon: "☕", label: "Java" },
  { id: "static", icon: "📄", label: "HTML/CSS" },
];

const SERVER_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  nodejs: { icon: "🟢", label: "Node.js" },
  python: { icon: "🐍", label: "Python" },
  php: { icon: "🐘", label: "PHP" },
  java: { icon: "☕", label: "Java" },
  rust: { icon: "🦀", label: "Rust" },
  "vanilla-mc": { icon: "⛏️", label: "Minecraft" },
  "paper-mc": { icon: "⛏️", label: "Paper MC" },
  "forge-mc": { icon: "⛏️", label: "Forge MC" },
  csgo: { icon: "🔫", label: "CS:GO" },
  gmod: { icon: "🔧", label: "Garry's Mod" },
  teamspeak: { icon: "🎙️", label: "TeamSpeak" },
};

interface Server {
  id: number;
  identifier: string;
  name: string;
  status: string | null;
  description: string;
}

export default function DeployPage() {
  const [, setLocation] = useLocation();

  // Server selection
  const [servers, setServers] = useState<Server[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  // Deploy config
  const [method, setMethod] = useState<"github" | "template">("github");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [startCommand, setStartCommand] = useState("");
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);

  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "building" | "done" | "error">("idle");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  function showToast(msg: string, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function addLog(msg: string) {
    setLogs(prev => [...prev, msg]);
  }

  // Fetch user's servers
  useEffect(() => {
    fetch("/api/servers")
      .then(r => r.json())
      .then(data => {
        setServers(data.servers || []);
        setServersLoading(false);
      })
      .catch(() => setServersLoading(false));
  }, []);

  function addEnvVar() {
    setEnvVars([...envVars, { key: "", value: "" }]);
  }
  function updateEnvVar(i: number, field: "key" | "value", val: string) {
    const v = [...envVars];
    v[i][field] = val;
    setEnvVars(v);
  }
  function removeEnvVar(i: number) {
    setEnvVars(envVars.filter((_, idx) => idx !== i));
  }

  async function deploy() {
    if (!selectedServer) {
      showToast("Sélectionnez un serveur de destination", "error");
      return;
    }
    if (!projectName.trim()) {
      showToast("Nom du projet requis", "error");
      return;
    }
    if (method === "github" && !githubUrl.trim()) {
      showToast("URL GitHub requise", "error");
      return;
    }
    if (method === "template" && !selectedTemplate) {
      showToast("Sélectionnez un template", "error");
      return;
    }

    setDeploying(true);
    setPhase("building");
    setLogs([
      `[info] Déploiement : ${projectName}`,
      `[info] Serveur cible : ${selectedServer.name} (${selectedServer.identifier})`,
      `[info] Méthode : ${method === "github" ? "GitHub" : "Template"}`,
    ]);

    try {
      // Build env vars object
      const envVarsObj: Record<string, string> = {};
      for (const v of envVars.filter(e => e.key.trim())) {
        envVarsObj[v.key.trim()] = v.value;
      }

      addLog("[build] Envoi des fichiers vers Pterodactyl...");

      const body: Record<string, any> = {
        projectName,
        envVars: envVarsObj,
        template: method === "template" ? selectedTemplate : undefined,
        gitUrl: method === "github" ? githubUrl.trim() : undefined,
        branch: branch || "main",
        startCommand: startCommand.trim() || undefined,
      };

      const res = await fetch(`/api/servers/${selectedServer.identifier}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        addLog(`[error] ${data.error || "Erreur de déploiement"}`);
        setPhase("error");
        showToast(data.error || "Erreur de déploiement", "error");
        setDeploying(false);
        return;
      }

      // Show server-side logs
      for (const serverLog of (data.logs || [])) {
        addLog(serverLog);
      }

      setPhase("done");

      setTimeout(() => {
        setLocation(`/servers/${selectedServer.identifier}`);
      }, 2500);
    } catch (e: any) {
      addLog(`[error] Erreur réseau: ${e.message}`);
      setPhase("error");
      showToast("Erreur réseau", "error");
    }
    setDeploying(false);
  }

  // Detect server type from name/description
  function getServerType(server: Server) {
    const n = (server.name + " " + server.description).toLowerCase();
    if (n.includes("node")) return "nodejs";
    if (n.includes("python")) return "python";
    if (n.includes("php")) return "php";
    if (n.includes("java")) return "java";
    if (n.includes("rust")) return "rust";
    if (n.includes("minecraft") || n.includes("mc")) return "vanilla-mc";
    if (n.includes("csgo") || n.includes("cs:go")) return "csgo";
    return "nodejs";
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px",
    background: "rgba(255,255,255,0.05)",
    border: `1.5px solid ${border}`,
    borderRadius: "10px", color: "#FAFAFA",
    fontFamily: "inherit", fontSize: "14px", outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.5px", color: "#52525B", marginBottom: "10px",
  };

  const cardStyle: React.CSSProperties = {
    background: surfaceStrong, border: `1px solid ${border}`,
    borderRadius: "16px", padding: "20px",
  };

  return (
    <FlyLayout title="Déployer">
      {toast && (
        <div style={{
          position: "fixed", top: "80px", right: "20px", zIndex: 9999,
          padding: "12px 18px", background: surfaceStrong,
          border: `1px solid ${border}`, borderRadius: "12px",
          fontSize: "14px", fontWeight: 600,
          borderLeft: `4px solid ${toast.type === "error" ? error : accent}`,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>🚀 Nouveau déploiement</h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Déployez votre projet sur un serveur FlyHost</p>
      </div>

      <div className="flex flex-col lg:grid lg:[grid-template-columns:380px_1fr] gap-5 items-start">

        {/* Left panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Step 1 — Server selection */}
          <div style={cardStyle}>
            <div style={labelStyle}>🖥️ Serveur de destination</div>
            {serversLoading ? (
              <p style={{ color: "#52525B", fontSize: "13px" }}>Chargement des serveurs...</p>
            ) : servers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ color: "#52525B", fontSize: "13px", marginBottom: "10px" }}>Aucun serveur disponible</p>
                <button
                  onClick={() => setLocation("/servers/new")}
                  style={{ padding: "8px 16px", background: accentDim, border: `1px solid ${border}`, color: accent, borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >
                  + Créer un serveur
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {servers.map(srv => {
                  const type = getServerType(srv);
                  const typeInfo = SERVER_TYPE_LABELS[type] || { icon: "🖥️", label: type };
                  const isSelected = selectedServer?.identifier === srv.identifier;
                  return (
                    <button
                      key={srv.identifier}
                      onClick={() => setSelectedServer(srv)}
                      style={{
                        display: "flex", alignItems: "center", gap: "12px",
                        padding: "12px 14px", border: `2px solid ${isSelected ? accent : border}`,
                        borderRadius: "12px", background: isSelected ? accentDim : "rgba(255,255,255,0.02)",
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
                      }}
                    >
                      <span style={{ fontSize: "22px" }}>{typeInfo.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: isSelected ? accent : "#FAFAFA" }}>
                          {srv.name.replace(/\s*\[FH-\d+\]/, "")}
                        </div>
                        <div style={{ fontSize: "11px", color: "#52525B", marginTop: "2px" }}>{typeInfo.label} · {srv.identifier}</div>
                      </div>
                      {isSelected && <span style={{ color: accent, fontSize: "16px" }}>✓</span>}
                    </button>
                  );
                })}
                <button
                  onClick={() => setLocation("/servers/new")}
                  style={{ padding: "10px", border: `1.5px dashed ${border}`, borderRadius: "10px", background: "transparent", color: "#52525B", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
                >
                  + Créer un nouveau serveur
                </button>
              </div>
            )}
          </div>

          {/* Step 2 — Project name */}
          <div style={cardStyle}>
            <div style={labelStyle}>📝 Nom du projet</div>
            <input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="mon-super-projet"
              style={inputStyle}
            />
          </div>

          {/* Step 3 — Method */}
          <div style={cardStyle}>
            <div style={labelStyle}>⚡ Source du code</div>
            <div style={{ display: "flex", border: `1.5px solid ${border}`, borderRadius: "10px", overflow: "hidden", marginBottom: "14px" }}>
              {([["github", "🐙", "GitHub / Git"], ["template", "📦", "Template"]] as [typeof method, string, string][]).map(([m, icon, lbl]) => (
                <button key={m} onClick={() => setMethod(m)} style={{
                  flex: 1, padding: "10px 4px", border: "none", fontFamily: "inherit", fontSize: "12px", fontWeight: 700,
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                  background: method === m ? accent : "transparent", color: method === m ? "#09090B" : "#71717A",
                }}>
                  <span style={{ fontSize: "18px" }}>{icon}</span> {lbl}
                </button>
              ))}
            </div>

            {method === "github" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  style={inputStyle}
                />
                <input
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  placeholder="Branche (main)"
                  style={inputStyle}
                />
                <input
                  value={startCommand}
                  onChange={e => setStartCommand(e.target.value)}
                  placeholder="Commande de démarrage (ex: node index.js)"
                  style={inputStyle}
                />
              </div>
            )}

            {method === "template" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setSelectedTemplate(t.id)} style={{
                    padding: "10px", border: `2px solid ${selectedTemplate === t.id ? accent : border}`,
                    borderRadius: "9px", background: selectedTemplate === t.id ? accentDim : "transparent",
                    color: selectedTemplate === t.id ? accent : "#A1A1AA",
                    fontFamily: "inherit", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}>
                    <span style={{ fontSize: "15px" }}>{t.icon}</span> {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 4 — Env vars */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={labelStyle}>🔑 Variables d'environnement</div>
              <button onClick={addEnvVar} style={{ padding: "4px 10px", background: accentDim, border: `1px solid ${border}`, color: accent, borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 700 }}>
                + Ajouter
              </button>
            </div>
            {envVars.length === 0 && <p style={{ fontSize: "12px", color: "#52525B" }}>Aucune variable configurée</p>}
            {envVars.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <input value={v.key} onChange={e => updateEnvVar(i, "key", e.target.value)} placeholder="CLE" style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }} />
                <input value={v.value} onChange={e => updateEnvVar(i, "value", e.target.value)} placeholder="valeur" type="password" style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }} />
                <button onClick={() => removeEnvVar(i)} style={{ padding: "7px 10px", background: "rgba(239,68,68,0.1)", border: "none", color: error, borderRadius: "8px", cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>

          {/* Deploy button */}
          <button
            onClick={deploy}
            disabled={deploying || !selectedServer}
            style={{
              width: "100%", padding: "16px",
              background: (deploying || !selectedServer) ? "rgba(250,204,21,0.4)" : accent,
              border: "none", color: "#09090B", borderRadius: "14px",
              fontWeight: 800, fontSize: "16px",
              cursor: (deploying || !selectedServer) ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {deploying ? "⏳ Déploiement en cours..." : !selectedServer ? "🖥️ Sélectionnez un serveur" : "🚀 Déployer maintenant"}
          </button>
        </div>

        {/* Right panel — logs */}
        <div style={{ background: "#0d0d0d", border: `1px solid ${border}`, borderRadius: "16px", overflow: "hidden", minHeight: "520px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", background: surfaceStrong, borderBottom: `1px solid ${border}`, padding: "0 8px", flexShrink: 0 }}>
            <button style={{ padding: "12px 16px", fontSize: "12px", fontWeight: 700, color: accent, border: "none", background: "none", fontFamily: "inherit", borderBottom: `2px solid ${accent}`, marginBottom: "-1px", cursor: "pointer" }}>
              Logs de déploiement
            </button>
          </div>

          <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: `1px solid ${border}`, background: "rgba(0,0,0,0.4)", flexShrink: 0 }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: phase === "done" ? green : phase === "error" ? error : phase === "building" ? warning : "#52525B" }} />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#A1A1AA" }}>
              {phase === "idle" ? "En attente" : phase === "building" ? "Déploiement en cours..." : phase === "done" ? "Déploiement réussi !" : "Erreur de déploiement"}
            </span>
          </div>

          <div style={{ flex: 1, padding: "16px", fontFamily: "monospace", fontSize: "12px", lineHeight: "1.6", overflowY: "auto", color: "#A1A1AA" }}>
            {logs.length === 0 ? (
              <div style={{ color: "#52525B", textAlign: "center", marginTop: "60px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📟</div>
                <p>Les logs de déploiement apparaîtront ici...</p>
                <p style={{ fontSize: "11px", marginTop: "8px" }}>Sélectionnez un serveur et cliquez sur Déployer</p>
              </div>
            ) : (
              logs.map((lg, i) => (
                <div key={i} style={{
                  color: lg.startsWith("[success]") ? green : lg.startsWith("[error]") ? error : lg.startsWith("[build]") ? accent : "#A1A1AA",
                  marginBottom: "4px",
                }}>
                  <span style={{ color: "#52525B", marginRight: "8px" }}>{String(i + 1).padStart(3, "0")}</span>
                  {lg}
                </div>
              ))
            )}
          </div>

          {phase === "done" && (
            <div style={{ padding: "16px", borderTop: `1px solid ${border}`, background: "rgba(16,185,129,0.06)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: green }} />
                <span style={{ color: green, fontWeight: 700, fontSize: "14px" }}>Déploiement réussi !</span>
                <span style={{ color: "#52525B", fontSize: "13px" }}>Redirection vers la console du serveur...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </FlyLayout>
  );
}
