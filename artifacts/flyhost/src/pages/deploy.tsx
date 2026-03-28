import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { FlyLayout } from "@/components/fly-layout";

const Y = "#FACC15";
const Ydim = "rgba(250,204,21,0.10)";
const Yborder = "rgba(250,204,21,0.18)";
const G = "#10b981";
const R = "#ef4444";
const Bg = "#09090B";
const Sur = "#111113";
const Sur2 = "#18181B";
const Muted = "#52525B";
const Text = "#FAFAFA";
const Sub = "#A1A1AA";

interface Server {
  id: number;
  identifier: string;
  name: string;
  status: string | null;
  description: string;
}

interface QuickStats {
  state: string;
  cpu: number;
  ram: number;
  ramLimit: number;
  disk: number;
  diskLimit: number;
  uptime: number;
}

interface LogEntry { level: string; message: string; timestamp: string; }

const EGG_ICONS: Record<string, string> = {
  nodejs: "⬡", python: "🐍", php: "🐘", java: "☕", rust: "🦀",
  "vanilla-mc": "⛏", "paper-mc": "⛏", "forge-mc": "⛏",
  csgo: "🎯", gmod: "🔧", teamspeak: "🎙", default: "🖥",
};

const EGG_LABELS: Record<string, string> = {
  nodejs: "Node.js", python: "Python", php: "PHP", java: "Java", rust: "Rust (jeu)",
  "vanilla-mc": "Minecraft Vanilla", "paper-mc": "Minecraft Paper", "forge-mc": "Minecraft Forge",
  csgo: "CS:GO", gmod: "Garry's Mod", teamspeak: "TeamSpeak 3",
};

function guessType(srv: Server): string {
  const n = (srv.name + " " + (srv.description || "")).toLowerCase();
  if (n.includes("node")) return "nodejs";
  if (n.includes("python")) return "python";
  if (n.includes("php")) return "php";
  if (n.includes("rust") && !n.includes("mc") && !n.includes("minecraft")) return "rust";
  if (n.includes("java") && !n.includes("javascript")) return "java";
  if (n.includes("paper")) return "paper-mc";
  if (n.includes("forge")) return "forge-mc";
  if (n.includes("minecraft") || n.match(/\bmc\b/)) return "vanilla-mc";
  if (n.includes("csgo") || n.includes("cs:go")) return "csgo";
  if (n.includes("gmod") || n.includes("garry")) return "gmod";
  if (n.includes("teamspeak") || n.includes("ts3")) return "teamspeak";
  return "nodejs";
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(0)} Mo`;
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} Go`;
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: "3px", background: "rgba(255,255,255,0.07)", borderRadius: "99px", width: "80px", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "99px", transition: "width 0.4s" }} />
    </div>
  );
}

const STEPS = ["Serveur", "Source", "Config", "Déploiement"];

export default function DeployPage() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);

  const [servers, setServers] = useState<Server[]>([]);
  const [serversLoading, setServersLoading] = useState(true);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [stats, setStats] = useState<Record<string, QuickStats>>({});

  const [method, setMethod] = useState<"github" | "zip">("github");
  const [gitUrl, setGitUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [startCommand, setStartCommand] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);

  const [deploying, setDeploying] = useState(false);
  const [deploymentId, setDeploymentId] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [phase, setPhase] = useState<"idle" | "building" | "done" | "failed">("idle");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  function showToast(msg: string, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    fetch("/api/servers")
      .then(r => r.json())
      .then(d => { setServers(d.servers || []); setServersLoading(false); })
      .catch(() => setServersLoading(false));
  }, []);

  useEffect(() => {
    if (servers.length === 0) return;
    servers.forEach(srv => {
      fetch(`/api/servers/${srv.identifier}/quick-stats`)
        .then(r => r.json())
        .then(d => setStats(prev => ({ ...prev, [srv.identifier]: d })))
        .catch(() => {});
    });
    const interval = setInterval(() => {
      servers.forEach(srv => {
        fetch(`/api/servers/${srv.identifier}/quick-stats`)
          .then(r => r.json())
          .then(d => setStats(prev => ({ ...prev, [srv.identifier]: d })))
          .catch(() => {});
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [servers]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  useEffect(() => {
    if (!deploymentId || !selectedServer) return;
    sseRef.current?.close();
    const url = `/api/servers/${selectedServer.identifier}/deploy/sse?deploymentId=${deploymentId}`;
    const es = new EventSource(url);
    sseRef.current = es;
    es.onmessage = (e) => {
      const data: LogEntry = JSON.parse(e.data);
      if (data.message === "__DEPLOY_COMPLETE__") { setPhase("done"); es.close(); return; }
      if (data.message === "__DEPLOY_FAILED__") { setPhase("failed"); es.close(); return; }
      setLogs(prev => [...prev, data]);
    };
    return () => es.close();
  }, [deploymentId, selectedServer]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.name.endsWith(".zip")) setZipFile(f);
    else showToast("Seuls les fichiers .zip sont acceptés", "error");
  }, []);

  async function deploy() {
    if (!selectedServer) return;
    setDeploying(true); setPhase("building"); setLogs([]);
    const ev: Record<string, string> = {};
    envVars.filter(v => v.key.trim()).forEach(v => { ev[v.key.trim()] = v.value; });
    try {
      let res: Response;
      if (method === "zip") {
        const fd = new FormData();
        fd.append("file", zipFile!);
        fd.append("identifier", selectedServer.identifier);
        fd.append("envVars", JSON.stringify(ev));
        res = await fetch("/api/deploy/zip", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/deploy/github", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: selectedServer.identifier, gitUrl: gitUrl.trim(), branch: branch || "main", startCommand: startCommand.trim() || undefined, envVars: ev }),
        });
      }
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "Erreur de déploiement", "error"); setPhase("failed"); setDeploying(false); return; }
      setDeploymentId(data.deploymentId);
    } catch { showToast("Erreur réseau", "error"); setPhase("failed"); setDeploying(false); }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 14px", boxSizing: "border-box",
    background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.09)",
    borderRadius: "10px", color: Text, fontFamily: "inherit", fontSize: "14px", outline: "none",
  };
  const lbl: React.CSSProperties = { fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: Muted, marginBottom: "8px", display: "block" };

  function logColor(level: string) {
    if (level === "success") return G;
    if (level === "error") return R;
    if (level === "warn") return Y;
    return Sub;
  }

  const stateColor = (s?: string) => {
    if (s === "running") return G;
    if (s === "starting") return Y;
    if (s === "stopping") return "#f59e0b";
    return Muted;
  };
  const stateLabel = (s?: string) => {
    if (s === "running") return "En ligne";
    if (s === "starting") return "Démarrage";
    if (s === "stopping") return "Arrêt";
    return "Hors ligne";
  };

  const canGoNext = () => {
    if (step === 0) return !!selectedServer;
    if (step === 1) return method === "zip" ? !!zipFile : !!gitUrl.trim();
    return true;
  };

  return (
    <FlyLayout title="Déployer">
      {toast && (
        <div style={{ position: "fixed", top: "80px", right: "20px", zIndex: 9999, padding: "12px 20px", background: Sur2, border: `1.5px solid ${toast.type === "error" ? R : Y}`, borderRadius: "12px", fontSize: "14px", fontWeight: 600, color: Text }}>
          {toast.msg}
        </div>
      )}

      {step < 3 ? (
        <>
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
              <div style={{ width: "36px", height: "36px", background: Ydim, border: `1.5px solid ${Yborder}`, borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🚀</div>
              <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px" }}>Nouveau déploiement</h1>
            </div>
            <p style={{ color: Muted, fontSize: "14px", marginLeft: "48px" }}>Déployez directement sur votre serveur Pterodactyl</p>
          </div>

          <div style={{ display: "flex", gap: 0, marginBottom: "32px", background: Sur2, borderRadius: "12px", padding: "4px", width: "fit-content" }}>
            {STEPS.slice(0, 3).map((s, i) => (
              <button key={i} onClick={() => i < step && setStep(i)} style={{
                padding: "8px 20px", borderRadius: "9px", border: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 700,
                cursor: i < step ? "pointer" : "default",
                background: step === i ? Y : "transparent",
                color: step === i ? Bg : i < step ? Sub : Muted,
              }}>
                <span style={{ opacity: 0.5, marginRight: "6px" }}>{i + 1}.</span>{s}
              </button>
            ))}
          </div>

          {step === 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                <span style={{ color: Muted, fontSize: "13px" }}>Sélectionnez le serveur Pterodactyl de destination</span>
                <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.05)" }} />
                <a href="https://panel.lionelmelo.qzz.io" target="_blank" rel="noreferrer" style={{ fontSize: "11px", color: Y, textDecoration: "none", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                  Ouvrir le panel ↗
                </a>
              </div>

              {serversLoading ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: Muted }}>Chargement depuis Pterodactyl...</div>
              ) : servers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <div style={{ fontSize: "48px", marginBottom: "12px" }}>🖥️</div>
                  <p style={{ color: Muted, marginBottom: "16px" }}>Aucun serveur disponible</p>
                  <button onClick={() => setLocation("/servers/new")} style={{ padding: "10px 20px", background: Y, border: "none", color: Bg, borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    + Créer un serveur
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                  {servers.map(srv => {
                    const type = guessType(srv);
                    const icon = EGG_ICONS[type] || "🖥";
                    const lbl2 = EGG_LABELS[type] || type;
                    const st = stats[srv.identifier];
                    const sel = selectedServer?.identifier === srv.identifier;
                    const online = st?.state === "running";
                    return (
                      <button key={srv.identifier} onClick={() => setSelectedServer(srv)} style={{
                        display: "flex", flexDirection: "column", gap: "12px", padding: "16px 18px",
                        border: `2px solid ${sel ? Y : "rgba(255,255,255,0.07)"}`,
                        borderRadius: "14px", background: sel ? Ydim : Sur2,
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                        transition: "border-color 0.2s, background 0.2s",
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                          <div style={{ width: "40px", height: "40px", background: "rgba(255,255,255,0.05)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: sel ? Y : Text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {srv.name.replace(/\s*\[FH-\d+\]/, "")}
                            </div>
                            <div style={{ fontSize: "11px", color: Muted, marginTop: "2px", fontFamily: "monospace" }}>{srv.identifier}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: stateColor(st?.state), boxShadow: online ? `0 0 8px ${G}` : "none" }} />
                            <span style={{ fontSize: "11px", color: stateColor(st?.state), fontWeight: 700 }}>{stateLabel(st?.state)}</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "11px", color: Muted }}>CPU</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <MiniBar value={st?.cpu ?? 0} max={100} color={Y} />
                              <span style={{ fontSize: "11px", color: Sub, fontFamily: "monospace", width: "42px", textAlign: "right" }}>{(st?.cpu ?? 0).toFixed(1)}%</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "11px", color: Muted }}>RAM</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <MiniBar value={st?.ram ?? 0} max={st?.ramLimit || 1} color={G} />
                              <span style={{ fontSize: "11px", color: Sub, fontFamily: "monospace", width: "42px", textAlign: "right" }}>{fmtBytes(st?.ram ?? 0)}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "11px", color: Muted }}>Disque</span>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <MiniBar value={st?.disk ?? 0} max={st?.diskLimit || 1} color="#818cf8" />
                              <span style={{ fontSize: "11px", color: Sub, fontFamily: "monospace", width: "42px", textAlign: "right" }}>{fmtBytes(st?.disk ?? 0)}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <span style={{ fontSize: "11px", color: Muted }}>{lbl2}</span>
                          {sel && <span style={{ fontSize: "12px", fontWeight: 800, color: Y }}>✓ Sélectionné</span>}
                        </div>
                      </button>
                    );
                  })}

                  <button onClick={() => setLocation("/servers/new")} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px",
                    padding: "40px 18px", border: `2px dashed rgba(255,255,255,0.08)`, borderRadius: "14px",
                    background: "transparent", cursor: "pointer", fontFamily: "inherit", color: Muted, fontSize: "13px", fontWeight: 700,
                  }}>
                    <span style={{ fontSize: "28px" }}>+</span>
                    Nouveau serveur
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div style={{ maxWidth: "560px" }}>
              <p style={{ color: Muted, fontSize: "13px", marginBottom: "24px" }}>
                Déploiement sur <span style={{ color: Y, fontWeight: 700 }}>{selectedServer?.name.replace(/\s*\[FH-\d+\]/, "")}</span> — choisissez la source de votre code
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                {([["github", "🐙", "GitHub / Git", "Clone depuis un dépôt public ou privé"], ["zip", "📦", "Fichier ZIP", "Uploadez une archive .zip de votre projet"]] as [typeof method, string, string, string][]).map(([m, ico, title, desc]) => (
                  <button key={m} onClick={() => setMethod(m)} style={{
                    padding: "20px", border: `2px solid ${method === m ? Y : "rgba(255,255,255,0.07)"}`,
                    borderRadius: "14px", background: method === m ? Ydim : Sur2,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>{ico}</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: method === m ? Y : Text, marginBottom: "4px" }}>{title}</div>
                    <div style={{ fontSize: "12px", color: Muted }}>{desc}</div>
                  </button>
                ))}
              </div>

              {method === "github" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <label style={lbl}>URL du dépôt Git</label>
                    <input value={gitUrl} onChange={e => setGitUrl(e.target.value)} placeholder="https://github.com/user/mon-projet" style={inp} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={lbl}>Branche</label>
                      <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="main" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Commande de démarrage</label>
                      <input value={startCommand} onChange={e => setStartCommand(e.target.value)} placeholder="node index.js" style={inp} />
                    </div>
                  </div>
                  <p style={{ fontSize: "12px", color: Muted }}>
                    Ou ajoutez un fichier <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: "4px" }}>flyhost.json</code> à la racine de votre projet.
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
                    border: `2px dashed ${dragging ? Y : zipFile ? G : "rgba(255,255,255,0.12)"}`,
                    borderRadius: "14px", padding: "48px 24px", textAlign: "center",
                    cursor: "pointer", transition: "all 0.2s",
                    background: dragging ? Ydim : zipFile ? "rgba(16,185,129,0.05)" : "transparent",
                  }}
                >
                  <input ref={fileInputRef} type="file" accept=".zip" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setZipFile(f); }} />
                  {zipFile ? (
                    <>
                      <div style={{ fontSize: "36px", marginBottom: "8px" }}>✅</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: G }}>{zipFile.name}</div>
                      <div style={{ fontSize: "12px", color: Muted, marginTop: "4px" }}>{(zipFile.size / 1024 / 1024).toFixed(2)} Mo</div>
                      <button onClick={e => { e.stopPropagation(); setZipFile(null); }} style={{ marginTop: "12px", fontSize: "12px", color: R, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Supprimer</button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: "40px", marginBottom: "10px" }}>📦</div>
                      <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "6px" }}>Glissez votre ZIP ici</div>
                      <div style={{ fontSize: "12px", color: Muted }}>ou cliquez pour sélectionner — max 200 Mo</div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div style={{ maxWidth: "560px" }}>
              <p style={{ color: Muted, fontSize: "13px", marginBottom: "24px" }}>
                Variables d'environnement et configuration avancée pour <span style={{ color: Y, fontWeight: 700 }}>{selectedServer?.name.replace(/\s*\[FH-\d+\]/, "")}</span>
              </p>

              <div style={{ background: Sur2, border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: Sub }}>🔑 Variables d'environnement</div>
                  <button onClick={() => setEnvVars(v => [...v, { key: "", value: "" }])} style={{ padding: "5px 12px", background: Ydim, border: `1px solid ${Yborder}`, color: Y, borderRadius: "7px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}>+ Ajouter</button>
                </div>
                {envVars.length === 0 ? (
                  <p style={{ fontSize: "13px", color: Muted, textAlign: "center", padding: "12px 0" }}>Aucune variable — cliquez sur « Ajouter »</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {envVars.map((v, i) => (
                      <div key={i} style={{ display: "flex", gap: "8px" }}>
                        <input value={v.key} onChange={e => setEnvVars(vs => { const n = [...vs]; n[i].key = e.target.value; return n; })} placeholder="CLE" style={{ ...inp, flex: 1, fontFamily: "monospace", fontSize: "13px" }} />
                        <input value={v.value} onChange={e => setEnvVars(vs => { const n = [...vs]; n[i].value = e.target.value; return n; })} placeholder="valeur" type="password" style={{ ...inp, flex: 1.5, fontFamily: "monospace", fontSize: "13px" }} />
                        <button onClick={() => setEnvVars(vs => vs.filter((_, idx) => idx !== i))} style={{ padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "none", color: R, borderRadius: "8px", cursor: "pointer", flexShrink: 0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background: Sur2, border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "16px 20px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: Muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Récapitulatif</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {[
                    ["Serveur", selectedServer?.name.replace(/\s*\[FH-\d+\]/, "") ?? "—"],
                    ["Identifiant", selectedServer?.identifier ?? "—"],
                    ["Source", method === "github" ? `GitHub — ${gitUrl || "—"}` : `ZIP — ${zipFile?.name || "—"}`],
                    ["Branche", method === "github" ? (branch || "main") : "—"],
                    ["Variables", `${envVars.filter(v => v.key.trim()).length} variable(s)`],
                  ].map(([k, val]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: Muted }}>{k}</span>
                      <span style={{ fontSize: "12px", fontFamily: "monospace", color: Sub }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{ padding: "12px 24px", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.09)", color: Sub, borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: "14px" }}>
                ← Retour
              </button>
            )}
            {step < 2 ? (
              <button onClick={() => { if (canGoNext()) setStep(s => s + 1); else showToast(step === 0 ? "Sélectionnez un serveur" : "Complétez la source", "error"); }} style={{ padding: "12px 28px", background: canGoNext() ? Y : "rgba(250,204,21,0.3)", border: "none", color: Bg, borderRadius: "10px", cursor: canGoNext() ? "pointer" : "not-allowed", fontFamily: "inherit", fontWeight: 800, fontSize: "14px" }}>
                Suivant →
              </button>
            ) : (
              <button onClick={() => { setStep(3); deploy(); }} style={{ padding: "14px 32px", background: Y, border: "none", color: Bg, borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
                🚀 Lancer le déploiement
              </button>
            )}
          </div>
        </>
      ) : (
        /* ───── STEP 4: TERMINAL DEPLOY VIEW ───── */
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", minHeight: "500px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "4px" }}>
                {phase === "done" ? "✅ Déploiement réussi" : phase === "failed" ? "❌ Déploiement échoué" : "⏳ Déploiement en cours..."}
              </h1>
              <p style={{ color: Muted, fontSize: "13px" }}>
                Serveur : <span style={{ color: Y, fontWeight: 700 }}>{selectedServer?.name.replace(/\s*\[FH-\d+\]/, "")}</span>
                {deploymentId && <span style={{ color: Muted }}> · ID #{deploymentId}</span>}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {phase === "done" && (
                <button onClick={() => setLocation(`/servers/${selectedServer?.identifier}`)} style={{ padding: "10px 20px", background: Y, border: "none", color: Bg, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: "13px" }}>
                  Ouvrir la console →
                </button>
              )}
              {phase === "failed" && (
                <button onClick={() => { setPhase("idle"); setDeploying(false); setLogs([]); setDeploymentId(null); setStep(0); }} style={{ padding: "10px 20px", background: Ydim, border: `1.5px solid ${Yborder}`, color: Y, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: "13px" }}>
                  ← Recommencer
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {(["Extraction", "Détection", "Snapshot", "Upload", "Redémarrage"] as string[]).map((label, i) => {
              const done = phase === "done" ? true : phase === "failed" ? false : logs.length > i * 2;
              const active = phase === "building" && logs.length >= i * 2 && logs.length < (i + 1) * 2;
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "20px", border: `1.5px solid ${done ? G : active ? Y : "rgba(255,255,255,0.07)"}`, background: done ? "rgba(16,185,129,0.08)" : active ? Ydim : "transparent" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: done ? G : active ? Y : Muted }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: done ? G : active ? Y : Muted }}>{label}</span>
                </div>
              );
            })}
          </div>

          <div style={{ flex: 1, background: "#0a0a0a", border: "1.5px solid rgba(255,255,255,0.07)", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0d0d0d", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#f59e0b" }} />
                <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#10b981" }} />
              </div>
              <span style={{ flex: 1, textAlign: "center", fontSize: "11px", color: Muted, fontFamily: "monospace" }}>flyhost · deploy · {selectedServer?.identifier}</span>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: phase === "building" ? Y : phase === "done" ? G : R, animation: phase === "building" ? "pulse 1.5s ease-in-out infinite" : "none" }} />
                <span style={{ fontSize: "11px", color: phase === "building" ? Y : phase === "done" ? G : R, fontWeight: 700 }}>
                  {phase === "building" ? "RUNNING" : phase === "done" ? "SUCCESS" : "FAILED"}
                </span>
              </div>
            </div>

            <div style={{ flex: 1, padding: "16px", fontFamily: "'Courier New', monospace", fontSize: "12.5px", lineHeight: "1.75", overflowY: "auto", color: Sub }}>
              {logs.length === 0 ? (
                <div style={{ color: Muted, marginTop: "24px" }}>
                  <span style={{ color: G }}>$</span> Connexion au serveur Pterodactyl...<br />
                  <span style={{ animation: "blink 1s step-end infinite" }}>_</span>
                </div>
              ) : (
                logs.map((lg, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "2px" }}>
                    <span style={{ color: "#2d2d2d", flexShrink: 0, userSelect: "none" }}>{String(i + 1).padStart(4, "0")}</span>
                    <span style={{ color: "#3f3f46", flexShrink: 0, fontSize: "11px", marginTop: "1px" }}>{new Date(lg.timestamp).toLocaleTimeString("fr-FR")}</span>
                    <span style={{ color: logColor(lg.level) }}>{lg.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {phase === "done" && (
            <div style={{ marginTop: "12px", padding: "14px 20px", background: "rgba(16,185,129,0.08)", border: `1.5px solid rgba(16,185,129,0.2)`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ color: G, fontWeight: 700, fontSize: "14px" }}>🎉 Déploiement terminé avec succès</span>
                <p style={{ color: Muted, fontSize: "12px", marginTop: "2px" }}>Votre application est maintenant en cours d'exécution sur Pterodactyl</p>
              </div>
              <button onClick={() => setLocation(`/servers/${selectedServer?.identifier}`)} style={{ padding: "10px 20px", background: G, border: "none", color: "#fff", borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: "13px", whiteSpace: "nowrap" }}>
                Voir la console →
              </button>
            </div>
          )}

          {phase === "failed" && (
            <div style={{ marginTop: "12px", padding: "14px 20px", background: "rgba(239,68,68,0.07)", border: `1.5px solid rgba(239,68,68,0.2)`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ color: R, fontWeight: 700, fontSize: "14px" }}>❌ Le déploiement a échoué</span>
                <p style={{ color: Muted, fontSize: "12px", marginTop: "2px" }}>Consultez les logs ci-dessus pour identifier l'erreur</p>
              </div>
              <button onClick={() => { setPhase("idle"); setDeploying(false); setLogs([]); setDeploymentId(null); setStep(0); }} style={{ padding: "10px 20px", background: Ydim, border: `1.5px solid ${Yborder}`, color: Y, borderRadius: "9px", cursor: "pointer", fontFamily: "inherit", fontWeight: 800, fontSize: "13px" }}>
                ← Recommencer
              </button>
            </div>
          )}
        </div>
      )}
    </FlyLayout>
  );
}
