import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { FlyLayout } from "@/components/fly-layout";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const errorColor = "#ef4444";
const warning = "#f59e0b";
const surfaceStrong = "rgba(28,28,35,0.97)";

const SERVER_TYPE_LABELS: Record<string, { icon: string; label: string }> = {
  nodejs:   { icon: "🟢", label: "Node.js" },
  python:   { icon: "🐍", label: "Python" },
  php:      { icon: "🐘", label: "PHP" },
  java:     { icon: "☕", label: "Java" },
  rust:     { icon: "🦀", label: "Rust" },
  "vanilla-mc": { icon: "⛏️", label: "Minecraft" },
  "paper-mc":   { icon: "⛏️", label: "Paper MC" },
  "forge-mc":   { icon: "⛏️", label: "Forge MC" },
  csgo:     { icon: "🔫", label: "CS:GO" },
  gmod:     { icon: "🔧", label: "Garry's Mod" },
  teamspeak:{ icon: "🎙️", label: "TeamSpeak" },
};

interface Server { id: number; identifier: string; name: string; status: string | null; description: string; }
interface LogEntry { level: string; message: string; timestamp: string; }

function getServerType(srv: Server) {
  const n = (srv.name + " " + srv.description).toLowerCase();
  if (n.includes("node")) return "nodejs";
  if (n.includes("python")) return "python";
  if (n.includes("php")) return "php";
  if (n.includes("java") && !n.includes("javascript")) return "java";
  if (n.includes("rust")) return "rust";
  if (n.includes("minecraft") || n.includes(" mc")) return "vanilla-mc";
  if (n.includes("csgo") || n.includes("cs:go")) return "csgo";
  return "nodejs";
}

export default function DeployPage() {
  const [, setLocation] = useLocation();

  // Servers
  const [servers, setServers] = useState<Server[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  // Method: zip | github
  const [method, setMethod] = useState<"zip" | "github">("github");

  // ZIP state
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GitHub state
  const [gitUrl, setGitUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [startCommand, setStartCommand] = useState("");

  // Env vars
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  // Deploy state
  const [deploying, setDeploying] = useState(false);
  const [deploymentId, setDeploymentId] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [phase, setPhase] = useState<"idle" | "building" | "done" | "failed">("idle");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  function showToast(msg: string, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Fetch servers
  useEffect(() => {
    fetch("/api/servers")
      .then(r => r.json())
      .then(d => { setServers(d.servers || []); setServersLoading(false); })
      .catch(() => setServersLoading(false));
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // SSE connection when deploymentId changes
  useEffect(() => {
    if (!deploymentId || !selectedServer) return;
    if (sseRef.current) { sseRef.current.close(); }

    const url = `/api/servers/${selectedServer.identifier}/deploy/sse?deploymentId=${deploymentId}`;
    const es = new EventSource(url);
    sseRef.current = es;

    es.onmessage = (e) => {
      const data: LogEntry = JSON.parse(e.data);
      if (data.message === "__DEPLOY_COMPLETE__") {
        setPhase("done");
        es.close();
        setTimeout(() => setLocation(`/servers/${selectedServer.identifier}`), 3000);
        return;
      }
      if (data.message === "__DEPLOY_FAILED__") {
        setPhase("failed");
        es.close();
        return;
      }
      setLogs(prev => [...prev, data]);
    };
    es.onerror = () => { /* SSE reconnects automatically */ };

    return () => { es.close(); };
  }, [deploymentId, selectedServer]);

  const addEnvVar = () => setEnvVars(v => [...v, { key: "", value: "" }]);
  const removeEnvVar = (i: number) => setEnvVars(v => v.filter((_, idx) => idx !== i));
  const updateEnvVar = (i: number, f: "key" | "value", val: string) => {
    setEnvVars(v => { const n = [...v]; n[i][f] = val; return n; });
  };

  // ZIP drag and drop
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.name.endsWith(".zip")) { setZipFile(file); }
    else showToast("Seuls les fichiers .zip sont acceptés", "error");
  }, []);

  async function deploy() {
    if (!selectedServer) { showToast("Sélectionnez un serveur", "error"); return; }
    if (method === "zip" && !zipFile) { showToast("Ajoutez un fichier ZIP", "error"); return; }
    if (method === "github" && !gitUrl.trim()) { showToast("URL Git requise", "error"); return; }

    setDeploying(true);
    setPhase("building");
    setLogs([]);

    const envVarsObj: Record<string, string> = {};
    envVars.filter(e => e.key.trim()).forEach(e => { envVarsObj[e.key.trim()] = e.value; });

    try {
      let res: Response;

      if (method === "zip") {
        const form = new FormData();
        form.append("file", zipFile!);
        form.append("identifier", selectedServer.identifier);
        form.append("envVars", JSON.stringify(envVarsObj));
        res = await fetch("/api/deploy/zip", { method: "POST", body: form });
      } else {
        res = await fetch("/api/deploy/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: selectedServer.identifier,
            gitUrl: gitUrl.trim(),
            branch: branch || "main",
            startCommand: startCommand.trim() || undefined,
            envVars: envVarsObj,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Erreur de déploiement", "error");
        setPhase("failed");
        setDeploying(false);
        return;
      }

      setDeploymentId(data.deploymentId);
      // SSE will handle the rest
    } catch (err: any) {
      showToast("Erreur réseau", "error");
      setPhase("failed");
      setDeploying(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)", border: `1.5px solid ${border}`,
    borderRadius: "10px", color: "#FAFAFA", fontFamily: "inherit", fontSize: "14px", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 800, textTransform: "uppercase",
    letterSpacing: "0.5px", color: "#52525B", marginBottom: "10px",
  };
  const cardStyle: React.CSSProperties = {
    background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "20px",
  };

  const logColor = (level: string) => {
    if (level === "success") return green;
    if (level === "error") return errorColor;
    if (level === "warn") return warning;
    if (level === "info" && false) return "#A1A1AA"; // default
    return "#A1A1AA";
  };

  return (
    <FlyLayout title="Déployer">
      {toast && (
        <div style={{
          position: "fixed", top: "80px", right: "20px", zIndex: 9999,
          padding: "12px 18px", background: surfaceStrong, border: `1px solid ${border}`,
          borderRadius: "12px", fontSize: "14px", fontWeight: 600,
          borderLeft: `4px solid ${toast.type === "error" ? errorColor : accent}`,
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>🚀 Nouveau déploiement</h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Déployez votre projet sur un serveur FlyHost via ZIP ou GitHub</p>
      </div>

      <div className="flex flex-col lg:grid lg:[grid-template-columns:380px_1fr] gap-5 items-start">

        {/* ── Left panel ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Server selection */}
          <div style={cardStyle}>
            <div style={labelStyle}>🖥️ Serveur de destination</div>
            {serversLoading ? (
              <p style={{ color: "#52525B", fontSize: "13px" }}>Chargement...</p>
            ) : servers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ color: "#52525B", fontSize: "13px", marginBottom: "10px" }}>Aucun serveur disponible</p>
                <button onClick={() => setLocation("/servers/new")} style={{ padding: "8px 16px", background: accentDim, border: `1px solid ${border}`, color: accent, borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}>
                  + Créer un serveur
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {servers.map(srv => {
                  const type = getServerType(srv);
                  const info = SERVER_TYPE_LABELS[type] || { icon: "🖥️", label: type };
                  const sel = selectedServer?.identifier === srv.identifier;
                  return (
                    <button key={srv.identifier} onClick={() => setSelectedServer(srv)} style={{
                      display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px",
                      border: `2px solid ${sel ? accent : border}`, borderRadius: "12px",
                      background: sel ? accentDim : "rgba(255,255,255,0.02)",
                      cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%",
                    }}>
                      <span style={{ fontSize: "22px" }}>{info.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: sel ? accent : "#FAFAFA" }}>
                          {srv.name.replace(/\s*\[FH-\d+\]/, "")}
                        </div>
                        <div style={{ fontSize: "11px", color: "#52525B", marginTop: "2px" }}>{info.label} · {srv.identifier}</div>
                      </div>
                      {sel && <span style={{ color: accent }}>✓</span>}
                    </button>
                  );
                })}
                <button onClick={() => setLocation("/servers/new")} style={{ padding: "10px", border: `1.5px dashed ${border}`, borderRadius: "10px", background: "transparent", color: "#52525B", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}>
                  + Nouveau serveur
                </button>
              </div>
            )}
          </div>

          {/* Method toggle */}
          <div style={cardStyle}>
            <div style={labelStyle}>⚡ Source du code</div>
            <div style={{ display: "flex", border: `1.5px solid ${border}`, borderRadius: "10px", overflow: "hidden", marginBottom: "16px" }}>
              {([["github", "🐙", "GitHub / Git"], ["zip", "📦", "Fichier ZIP"]] as [typeof method, string, string][]).map(([m, icon, lbl]) => (
                <button key={m} onClick={() => setMethod(m)} style={{
                  flex: 1, padding: "10px", border: "none", fontFamily: "inherit", fontSize: "12px", fontWeight: 700,
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                  background: method === m ? accent : "transparent", color: method === m ? "#09090B" : "#71717A",
                }}>
                  <span style={{ fontSize: "18px" }}>{icon}</span>{lbl}
                </button>
              ))}
            </div>

            {method === "github" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input value={gitUrl} onChange={e => setGitUrl(e.target.value)} placeholder="https://github.com/user/repo" style={inputStyle} />
                <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branche (main)" style={inputStyle} />
                <input value={startCommand} onChange={e => setStartCommand(e.target.value)} placeholder="Commande de démarrage (optionnel)" style={inputStyle} />
                <p style={{ fontSize: "11px", color: "#52525B", marginTop: "2px" }}>
                  Ou ajoutez un fichier <code style={{ background: "rgba(255,255,255,0.07)", padding: "1px 5px", borderRadius: "4px" }}>flyhost.json</code> dans votre repo
                </p>
              </div>
            )}

            {method === "zip" && (
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? accent : zipFile ? green : border}`,
                  borderRadius: "12px", padding: "28px 16px", textAlign: "center",
                  cursor: "pointer", transition: "border-color 0.2s",
                  background: dragging ? accentDim : zipFile ? "rgba(16,185,129,0.06)" : "transparent",
                }}
              >
                <input ref={fileInputRef} type="file" accept=".zip" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setZipFile(f); }} />
                {zipFile ? (
                  <>
                    <div style={{ fontSize: "28px", marginBottom: "6px" }}>✅</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: green }}>{zipFile.name}</div>
                    <div style={{ fontSize: "11px", color: "#52525B", marginTop: "4px" }}>{(zipFile.size / 1024 / 1024).toFixed(2)} Mo</div>
                    <button onClick={e => { e.stopPropagation(); setZipFile(null); }} style={{ marginTop: "8px", fontSize: "11px", color: errorColor, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Supprimer</button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "32px", color: accent, marginBottom: "8px" }}>📦</div>
                    <div style={{ fontSize: "13px", fontWeight: 700 }}>Glissez votre ZIP ici</div>
                    <div style={{ fontSize: "11px", color: "#52525B", marginTop: "4px" }}>ou cliquez pour sélectionner · max {200} Mo</div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Env vars */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={labelStyle}>🔑 Variables d'env.</div>
              <button onClick={addEnvVar} style={{ padding: "4px 10px", background: accentDim, border: `1px solid ${border}`, color: accent, borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 700 }}>
                + Ajouter
              </button>
            </div>
            {envVars.length === 0 && <p style={{ fontSize: "12px", color: "#52525B" }}>Aucune variable configurée</p>}
            {envVars.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <input value={v.key} onChange={e => updateEnvVar(i, "key", e.target.value)} placeholder="CLE" style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: "12px" }} />
                <input value={v.value} onChange={e => updateEnvVar(i, "value", e.target.value)} placeholder="valeur" type="password" style={{ ...inputStyle, flex: 1, fontFamily: "monospace", fontSize: "12px" }} />
                <button onClick={() => removeEnvVar(i)} style={{ padding: "7px 10px", background: "rgba(239,68,68,0.1)", border: "none", color: errorColor, borderRadius: "8px", cursor: "pointer", flexShrink: 0 }}>✕</button>
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
              fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {deploying ? "⏳ Déploiement en cours..." : !selectedServer ? "🖥️ Sélectionnez un serveur" : "🚀 Déployer maintenant"}
          </button>
        </div>

        {/* ── Right panel — live logs ── */}
        <div style={{ background: "#0d0d0d", border: `1px solid ${border}`, borderRadius: "16px", overflow: "hidden", minHeight: "560px", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: surfaceStrong, borderBottom: `1px solid ${border}`, padding: "10px 16px", flexShrink: 0 }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: accent }}>Logs de déploiement</span>
            {deploymentId && <span style={{ fontSize: "11px", color: "#52525B", fontFamily: "monospace" }}>ID #{deploymentId}</span>}
          </div>

          {/* Status bar */}
          <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: `1px solid ${border}`, background: "rgba(0,0,0,0.4)", flexShrink: 0 }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: phase === "done" ? green : phase === "failed" ? errorColor : phase === "building" ? warning : "#52525B",
              animation: phase === "building" ? "pulse 1.5s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#A1A1AA" }}>
              {phase === "idle" ? "En attente" : phase === "building" ? "Déploiement en cours..." : phase === "done" ? "✅ Déploiement réussi !" : "❌ Échec du déploiement"}
            </span>
          </div>

          {/* Log output */}
          <div style={{ flex: 1, padding: "14px 16px", fontFamily: "monospace", fontSize: "12px", lineHeight: "1.7", overflowY: "auto", color: "#A1A1AA" }}>
            {logs.length === 0 ? (
              <div style={{ color: "#52525B", textAlign: "center", marginTop: "60px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📟</div>
                <p>Les logs apparaîtront ici en temps réel</p>
                <p style={{ fontSize: "11px", marginTop: "8px" }}>Sélectionnez un serveur et cliquez sur Déployer</p>
              </div>
            ) : (
              logs.map((lg, i) => (
                <div key={i} style={{ color: logColor(lg.level), marginBottom: "3px", display: "flex", gap: "8px" }}>
                  <span style={{ color: "#3f3f46", flexShrink: 0 }}>{String(i + 1).padStart(4, "0")}</span>
                  <span style={{ color: "#3f3f46", flexShrink: 0, fontSize: "10px" }}>
                    {new Date(lg.timestamp).toLocaleTimeString("fr-FR")}
                  </span>
                  <span>{lg.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Success banner */}
          {phase === "done" && (
            <div style={{ padding: "16px", borderTop: `1px solid ${border}`, background: "rgba(16,185,129,0.08)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: green, fontWeight: 700, fontSize: "14px" }}>🎉 Déploiement réussi !</span>
                <span style={{ color: "#52525B", fontSize: "13px" }}>Redirection vers la console dans 3 secondes...</span>
              </div>
            </div>
          )}

          {/* Failure banner */}
          {phase === "failed" && (
            <div style={{ padding: "16px", borderTop: `1px solid ${border}`, background: "rgba(239,68,68,0.08)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: errorColor, fontWeight: 700, fontSize: "14px" }}>❌ Déploiement échoué</span>
                <button onClick={() => { setPhase("idle"); setDeploying(false); setLogs([]); setDeploymentId(null); }} style={{ fontSize: "12px", color: accent, background: accentDim, border: `1px solid ${border}`, borderRadius: "6px", padding: "4px 12px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  Réessayer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </FlyLayout>
  );
}
