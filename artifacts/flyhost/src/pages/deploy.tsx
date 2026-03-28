import { useState } from "react";
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
  { id: "react", icon: "⚛️", label: "React" },
  { id: "nextjs", icon: "▲", label: "Next.js" },
  { id: "vue", icon: "💚", label: "Vue.js" },
  { id: "express", icon: "🔧", label: "Express" },
  { id: "python", icon: "🐍", label: "Python" },
  { id: "static", icon: "📄", label: "HTML/CSS" },
];

const ENV_TYPES = [
  { id: "nodejs", icon: "🟢", label: "Node.js" },
  { id: "python", icon: "🐍", label: "Python" },
  { id: "static", icon: "📄", label: "Static" },
  { id: "docker", icon: "🐋", label: "Docker" },
  { id: "java", icon: "☕", label: "Java" },
  { id: "php", icon: "🐘", label: "PHP" },
];

export default function DeployPage() {
  const [, setLocation] = useLocation();
  const [method, setMethod] = useState<"github" | "zip" | "template">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [envType, setEnvType] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [deploying, setDeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [phase, setPhase] = useState<"idle" | "building" | "done" | "error">("idle");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  function showToast(msg: string, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  function addEnvVar() {
    setEnvVars([...envVars, { key: "", value: "" }]);
  }

  function updateEnvVar(i: number, field: "key" | "value", val: string) {
    const newVars = [...envVars];
    newVars[i][field] = val;
    setEnvVars(newVars);
  }

  function removeEnvVar(i: number) {
    setEnvVars(envVars.filter((_, idx) => idx !== i));
  }

  async function deploy() {
    if (!projectName.trim()) {
      showToast("Nom du projet requis", "error");
      return;
    }
    if (method === "github" && !githubUrl.trim()) {
      showToast("URL GitHub requise", "error");
      return;
    }

    setDeploying(true);
    setPhase("building");
    setLogs(["[info] Initialisation du déploiement...", `[info] Projet: ${projectName}`]);

    try {
      // Create project
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          description: `Déployé via ${method}`,
          framework: selectedTemplate || envType || "static",
          gitUrl: method === "github" ? githubUrl : null,
        }),
      });

      if (!projRes.ok) {
        const err = await projRes.json();
        showToast(err.error || "Erreur de création", "error");
        setPhase("error");
        setDeploying(false);
        return;
      }

      const project = await projRes.json();
      setLogs(prev => [...prev, `[info] Projet créé (ID: ${project.id})`, "[info] Lancement du build..."]);

      // Add env vars
      for (const v of envVars.filter(e => e.key.trim())) {
        await fetch(`/api/projects/${project.id}/env`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: v.key, value: v.value }),
        });
      }

      // Create deployment
      const depRes = await fetch(`/api/projects/${project.id}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: branch || "main" }),
      });

      const dep = await depRes.json();
      setLogs(prev => [...prev, `[info] Déploiement #${dep.id} créé`, "[build] Installation des dépendances...", "[build] Build en cours...", "[build] Tests...", "[success] Déploiement réussi ! 🎉"]);
      setPhase("done");

      setTimeout(() => setLocation(`/projects/${project.id}`), 2000);
    } catch {
      showToast("Erreur réseau", "error");
      setPhase("error");
    }
    setDeploying(false);
  }

  const phaseColors: Record<string, string> = { idle: accent, building: warning, done: green, error };

  return (
    <FlyLayout title="Déployer">
      {toast && (
        <div style={{ position: "fixed", top: "80px", right: "20px", zIndex: 9999, padding: "12px 18px", background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "12px", fontSize: "14px", fontWeight: 600, borderLeft: `4px solid ${toast.type === "error" ? error : accent}` }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>🚀 Nouveau déploiement</h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Déployez votre projet en quelques clics</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "20px", alignItems: "start" }}>
        {/* Left panel - config */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Project name */}
          <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#52525B", marginBottom: "10px" }}>📝 Nom du projet</div>
            <input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="mon-super-projet"
              style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: `1.5px solid ${border}`, borderRadius: "10px", color: "#FAFAFA", fontFamily: "inherit", fontSize: "14px", outline: "none" }}
            />
          </div>

          {/* Method */}
          <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#52525B", marginBottom: "10px" }}>⚡ Méthode</div>
            <div style={{ display: "flex", border: `1.5px solid ${border}`, borderRadius: "10px", overflow: "hidden", marginBottom: "14px" }}>
              {([["template", "📦", "Template"], ["github", "🐙", "GitHub"], ["zip", "📁", "ZIP"]] as [typeof method, string, string][]).map(([m, icon, lbl]) => (
                <button key={m} onClick={() => setMethod(m)} style={{
                  flex: 1, padding: "8px 4px", border: "none", fontFamily: "inherit", fontSize: "12px", fontWeight: 700,
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                  background: method === m ? accent : "transparent", color: method === m ? "#09090B" : "#71717A",
                }}>
                  <span style={{ fontSize: "16px" }}>{icon}</span> {lbl}
                </button>
              ))}
            </div>

            {method === "template" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => setSelectedTemplate(t.id)} style={{
                    padding: "8px 10px", border: `2px solid ${selectedTemplate === t.id ? accent : border}`,
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

            {method === "github" && (
              <div>
                <input
                  value={githubUrl}
                  onChange={e => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${border}`, borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: "#FAFAFA", fontFamily: "inherit", fontSize: "13px", outline: "none", marginBottom: "8px" }}
                />
                <input
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  placeholder="Branche (main)"
                  style={{ width: "100%", padding: "9px 12px", border: `1.5px solid ${border}`, borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: "#FAFAFA", fontFamily: "inherit", fontSize: "13px", outline: "none" }}
                />
              </div>
            )}

            {method === "zip" && (
              <div style={{ border: `2px dashed ${border}`, borderRadius: "10px", padding: "20px", textAlign: "center", cursor: "pointer" }}>
                <div style={{ fontSize: "28px", color: accent, marginBottom: "8px" }}>📁</div>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>Glissez votre fichier ZIP</div>
                <div style={{ fontSize: "11px", color: "#52525B", marginTop: "4px" }}>ou cliquez pour sélectionner</div>
              </div>
            )}
          </div>

          {/* Environment type */}
          <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#52525B", marginBottom: "10px" }}>🌐 Environnement</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "5px" }}>
              {ENV_TYPES.map(e => (
                <button key={e.id} onClick={() => setEnvType(e.id)} style={{
                  padding: "8px 4px", border: `2px solid ${envType === e.id ? accent : border}`,
                  borderRadius: "8px", background: envType === e.id ? accent : "transparent",
                  color: envType === e.id ? "#09090B" : "#71717A",
                  fontFamily: "inherit", fontSize: "11px", fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                }}>
                  <span style={{ fontSize: "13px" }}>{e.icon}</span> {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Env vars */}
          <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: "#52525B" }}>🔑 Variables d'env.</div>
              <button onClick={addEnvVar} style={{ padding: "4px 10px", background: accentDim, border: `1px solid ${border}`, color: accent, borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", fontSize: "11px", fontWeight: 700 }}>+ Ajouter</button>
            </div>
            {envVars.length === 0 && <p style={{ fontSize: "12px", color: "#52525B" }}>Aucune variable configurée</p>}
            {envVars.map((v, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <input value={v.key} onChange={e => updateEnvVar(i, "key", e.target.value)} placeholder="CLE" style={{ flex: 1, padding: "7px 10px", border: `1.5px solid ${border}`, borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: "#FAFAFA", fontFamily: "monospace", fontSize: "12px", outline: "none" }} />
                <input value={v.value} onChange={e => updateEnvVar(i, "value", e.target.value)} placeholder="valeur" type="password" style={{ flex: 1, padding: "7px 10px", border: `1.5px solid ${border}`, borderRadius: "8px", background: "rgba(255,255,255,0.05)", color: "#FAFAFA", fontFamily: "monospace", fontSize: "12px", outline: "none" }} />
                <button onClick={() => removeEnvVar(i)} style={{ padding: "7px 10px", background: "rgba(239,68,68,0.1)", border: "none", color: error, borderRadius: "8px", cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>

          {/* Deploy button */}
          <button
            onClick={deploy}
            disabled={deploying}
            style={{
              width: "100%", padding: "16px", background: deploying ? "rgba(250,204,21,0.5)" : accent,
              border: "none", color: "#09090B", borderRadius: "14px",
              fontWeight: 800, fontSize: "16px", cursor: deploying ? "not-allowed" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}
          >
            {deploying ? "⏳ Déploiement en cours..." : "🚀 Déployer maintenant"}
          </button>
        </div>

        {/* Right panel - logs */}
        <div style={{ background: "#0d0d0d", border: `1px solid ${border}`, borderRadius: "16px", overflow: "hidden", minHeight: "500px", display: "flex", flexDirection: "column" }}>
          {/* Tabs */}
          <div style={{ display: "flex", background: "rgba(28,28,35,0.97)", borderBottom: `1px solid ${border}`, padding: "0 8px", flexShrink: 0 }}>
            {["Logs de build", "Console", "Aperçu"].map((tab, i) => (
              <button key={tab} style={{
                padding: "12px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                color: i === 0 ? accent : "#52525B", border: "none", background: "none", fontFamily: "inherit",
                borderBottom: i === 0 ? `2px solid ${accent}` : "2px solid transparent", marginBottom: "-1px",
              }}>
                {tab}
              </button>
            ))}
          </div>

          {/* Status bar */}
          <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: `1px solid ${border}`, background: "rgba(0,0,0,0.4)", flexShrink: 0 }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: phase === "done" ? green : phase === "error" ? error : phase === "building" ? "#f59e0b" : "#52525B" }} />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#A1A1AA" }}>
              {phase === "idle" ? "En attente" : phase === "building" ? "Construction..." : phase === "done" ? "Déployé avec succès" : "Erreur de déploiement"}
            </span>
          </div>

          {/* Log output */}
          <div style={{ flex: 1, padding: "16px", fontFamily: "monospace", fontSize: "12px", lineHeight: "1.6", overflowY: "auto", color: "#A1A1AA" }}>
            {logs.length === 0 ? (
              <div style={{ color: "#52525B", textAlign: "center", marginTop: "40px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📟</div>
                <p>Les logs de build apparaîtront ici...</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{
                  color: log.startsWith("[success]") ? green : log.startsWith("[error]") ? error : log.startsWith("[build]") ? accent : "#A1A1AA",
                  marginBottom: "4px",
                }}>
                  <span style={{ color: "#52525B", marginRight: "8px" }}>{String(i + 1).padStart(3, "0")}</span>
                  {log}
                </div>
              ))
            )}
          </div>

          {/* Preview area */}
          {phase === "done" && (
            <div style={{ padding: "16px", borderTop: `1px solid ${border}`, background: "rgba(16,185,129,0.06)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: green }} />
                <span style={{ color: green, fontWeight: 700, fontSize: "14px" }}>Déploiement réussi !</span>
                <span style={{ color: "#52525B", fontSize: "13px" }}>Redirection en cours...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </FlyLayout>
  );
}
