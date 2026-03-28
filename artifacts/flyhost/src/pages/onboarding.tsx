import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const steps = [
  { label: "Bienvenue", num: 1 },
  { label: "Mon projet", num: 2 },
  { label: "C'est parti !", num: 3 },
];

const projectTypes = [
  { id: "web", icon: "🌐", label: "App Web" },
  { id: "discord", icon: "🎮", label: "Bot Discord" },
  { id: "minecraft", icon: "🧊", label: "Minecraft" },
  { id: "python", icon: "🐍", label: "Script Python" },
  { id: "game", icon: "🎮", label: "Autre jeu" },
  { id: "other", icon: "⋯", label: "Autre" },
];

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.18)";
const green = "#10b981";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem("flyhost_onboarding_done");
    if (done === "1") setLocation("/dashboard");
  }, [user]);

  function goStep(n: number) {
    if (n === 3) {
      localStorage.setItem("flyhost_onboarding_done", "1");
      fetch("/api/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }
    setStep(n);
  }

  function finishOnboarding() {
    setLocation("/dashboard");
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", background: "#09090B", color: "#FAFAFA", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative", overflow: "hidden" }}>
      {/* Orbs */}
      <div style={{ position: "fixed", inset: 0, zIndex: -1, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: "600px", height: "600px", borderRadius: "50%", background: "rgba(250,204,21,0.5)", filter: "blur(100px)", opacity: 0.15, top: "-200px", left: "-100px" }} />
        <div style={{ position: "absolute", width: "500px", height: "500px", borderRadius: "50%", background: "rgba(234,88,12,0.4)", filter: "blur(100px)", opacity: 0.15, bottom: "-100px", right: "-100px" }} />
      </div>

      <div style={{ width: "100%", maxWidth: "520px", background: "rgba(14,14,19,0.97)", border: `1px solid ${border}`, borderRadius: "28px", padding: "40px 36px", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "32px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "16px", color: "#09090B" }}>F</div>
          <span style={{ fontSize: "20px", fontWeight: 900 }}>FLY<span style={{ color: accent }}>HOST</span></span>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: "36px" }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: "14px",
                  background: step > s.num ? green : step === s.num ? accent : "transparent",
                  border: `2px solid ${step >= s.num ? (step > s.num ? green : accent) : border}`,
                  color: step > s.num ? "white" : step === s.num ? "#09090B" : "#52525B",
                }}>
                  {step > s.num ? "✓" : s.num}
                </div>
                <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: step === s.num ? accent : step > s.num ? green : "#52525B", whiteSpace: "nowrap" }}>{s.label}</div>
              </div>
              {i < steps.length - 1 && (
                <div style={{ height: "2px", width: "60px", background: step > s.num ? green : border, marginBottom: "22px" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <div style={{ width: "72px", height: "72px", borderRadius: "20px", background: accentDim, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 20px" }}>🚀</div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, textAlign: "center", marginBottom: "8px" }}>Bienvenue sur FLYHOST ! 🎉</h1>
            <p style={{ fontSize: "14px", color: "#71717A", textAlign: "center", marginBottom: "24px", lineHeight: 1.6 }}>Votre compte est prêt. Vous avez reçu des coins de bienvenue pour démarrer !</p>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", background: accentDim, border: `1px solid rgba(250,204,21,0.22)`, borderRadius: "14px", marginBottom: "24px" }}>
              <span style={{ fontSize: "28px" }}>🪙</span>
              <div>
                <div style={{ fontSize: "36px", fontWeight: 900, color: accent, lineHeight: 1 }}>+10</div>
                <div style={{ fontSize: "12px", color: "#71717A", fontWeight: 600 }}>coins offerts</div>
              </div>
              <div style={{ width: "1px", height: "40px", background: "rgba(250,204,21,0.2)", margin: "0 4px" }} />
              <div style={{ fontSize: "13px", color: "#A1A1AA", lineHeight: 1.4 }}>
                Gagnez <strong style={{ color: accent }}>10 coins</strong> chaque jour.<br />Invitez des amis pour en gagner plus !
              </div>
            </div>

            {[
              { icon: "🖥️", title: "Projets déployés", desc: "React, Vue, Express, Minecraft..." },
              { icon: "🎮", title: "Bots Discord hébergés", desc: "Node.js, Python — en 1 clic" },
              { icon: "🌐", title: "Domaines personnalisés", desc: "Votre domaine, votre marque" },
            ].map(f => (
              <div key={f.title} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid rgba(250,204,21,0.08)`, borderRadius: "12px", marginBottom: "8px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{f.icon}</div>
                <div>
                  <strong style={{ display: "block", fontSize: "13px", fontWeight: 700 }}>{f.title}</strong>
                  <span style={{ fontSize: "12px", color: "#71717A" }}>{f.desc}</span>
                </div>
              </div>
            ))}

            <button onClick={() => goStep(2)} style={{ width: "100%", padding: "14px", borderRadius: "50px", border: "none", background: accent, color: "#09090B", fontWeight: 800, fontSize: "15px", cursor: "pointer", marginTop: "16px", fontFamily: "inherit" }}>
              → Continuons
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <div style={{ width: "72px", height: "72px", borderRadius: "20px", background: accentDim, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 20px" }}>📦</div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, textAlign: "center", marginBottom: "8px" }}>Quel est votre projet ?</h1>
            <p style={{ fontSize: "14px", color: "#71717A", textAlign: "center", marginBottom: "24px", lineHeight: 1.6 }}>Cela nous aide à vous guider vers le bon déploiement.</p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              {projectTypes.map(pt => (
                <button key={pt.id} onClick={() => setSelected(pt.id)} style={{
                  padding: "14px 12px", borderRadius: "12px",
                  border: `1.5px solid ${selected === pt.id ? accent : border}`,
                  background: selected === pt.id ? accentDim : "transparent",
                  color: selected === pt.id ? accent : "#A1A1AA",
                  fontFamily: "inherit", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                  transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: "22px" }}>{pt.icon}</span>
                  {pt.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => goStep(3)}
              disabled={!selected}
              style={{
                width: "100%", padding: "14px", borderRadius: "50px", border: "none",
                background: selected ? accent : "rgba(250,204,21,0.3)",
                color: "#09090B", fontWeight: 800, fontSize: "15px",
                cursor: selected ? "pointer" : "not-allowed", fontFamily: "inherit",
              }}
            >
              → Continuer
            </button>
            <button onClick={() => goStep(3)} style={{ width: "100%", padding: "10px", borderRadius: "50px", border: "none", background: "transparent", color: "#52525B", fontWeight: 600, fontSize: "13px", cursor: "pointer", marginTop: "8px", fontFamily: "inherit" }}>
              Passer cette étape
            </button>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: `2px solid ${green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "44px", color: green, margin: "0 auto 24px" }}>✓</div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "8px" }}>C'est parti ! 🚀</h1>
            <p style={{ fontSize: "14px", color: "#71717A", marginBottom: "24px", lineHeight: 1.6 }}>Votre profil est configuré. Rendez-vous sur le dashboard !</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "24px", textAlign: "left" }}>
              {[
                { href: "/dashboard", icon: "📊", title: "Dashboard", desc: "Voir mes projets" },
                { href: "/deploy", icon: "🚀", title: "Déployer", desc: "Lancer un projet" },
                { href: "/referral", icon: "👥", title: "Inviter", desc: "Gagner des coins" },
                { href: "/subscription", icon: "💎", title: "Plans", desc: "Voir les offres" },
              ].map(a => (
                <a key={a.href} href={a.href} style={{
                  display: "flex", alignItems: "center", gap: "10px", padding: "14px", borderRadius: "12px",
                  background: accentDim, border: `1px solid rgba(250,204,21,0.2)`,
                  textDecoration: "none", color: "#FAFAFA",
                }}>
                  <span style={{ fontSize: "20px" }}>{a.icon}</span>
                  <div>
                    <strong style={{ fontSize: "13px", display: "block" }}>{a.title}</strong>
                    <span style={{ fontSize: "11px", color: "#71717A" }}>{a.desc}</span>
                  </div>
                </a>
              ))}
            </div>

            <button onClick={finishOnboarding} style={{ width: "100%", padding: "14px", borderRadius: "50px", border: "none", background: accent, color: "#09090B", fontWeight: 800, fontSize: "15px", cursor: "pointer", fontFamily: "inherit" }}>
              📊 Aller au Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
