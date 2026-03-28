import { useState, useEffect } from "react";
import { FlyLayout } from "@/components/fly-layout";
import { useAuth } from "@/hooks/use-auth";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const warning = "#f59e0b";
const error = "#ef4444";
const blue = "#3b82f6";
const surfaceStrong = "rgba(28,28,35,0.97)";

const RESELLER_PLANS = [
  { id: "starter", name: "🌱 Pack Starter", cost: 1000, margin: "10%", servers: 5, label: "Pack 5 serveurs" },
  { id: "pro", name: "🚀 Pack Pro", cost: 3000, margin: "15%", servers: 20, label: "Pack 20 serveurs" },
  { id: "business", name: "💼 Pack Business", cost: 8000, margin: "20%", servers: 100, label: "Pack 100 serveurs" },
];

const FEATURES = [
  { icon: "💰", title: "Marges attractives", desc: "De 10% à 20% selon le volume" },
  { icon: "🏷️", title: "White-label", desc: "Votre marque sur tous les services" },
  { icon: "📊", title: "Dashboard revendeur", desc: "Gestion centralisée de vos clients" },
  { icon: "🎧", title: "Support prioritaire", desc: "Ligne dédiée revendeur 7j/7" },
  { icon: "📈", title: "Stats détaillées", desc: "Revenu, marge, activité clients" },
  { icon: "🔑", title: "API complète", desc: "Intégrez FLYHOST dans vos outils" },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  function showToast(msg: string, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/profile");
        if (res.ok) {
          const d = await res.json();
          setProfile(d.user);
        }
      } catch {}
    }
    load();
  }, []);

  const TABS = [
    { id: "overview", label: "Vue d'ensemble", icon: "📊" },
    { id: "plans", label: "Packs revendeur", icon: "💼" },
    { id: "clients", label: "Mes clients", icon: "👥" },
    { id: "stats", label: "Statistiques", icon: "📈" },
  ];

  const coins = profile?.coins ?? 0;

  return (
    <FlyLayout title="Espace Revendeur">
      {toast && (
        <div style={{ position: "fixed", top: "80px", right: "20px", zIndex: 9999, padding: "12px 18px", background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "12px", fontSize: "14px", fontWeight: 600, borderLeft: `4px solid ${toast.type === "success" ? green : toast.type === "error" ? error : accent}` }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>🏪 Espace Revendeur</h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Revendez les services FLYHOST à vos clients et gagnez des marges attractives</p>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%)",
        borderRadius: "20px", padding: "28px 32px", marginBottom: "28px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.03'%3E%3Cpath d='M0 0h20v20H0zm20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E\")", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", position: "relative" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "rgba(165,180,252,0.8)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Programme Revendeur</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: "#fff", marginBottom: "4px" }}>{user?.name || "Revendeur"}</div>
            <div style={{ fontSize: "14px", color: "rgba(199,210,254,0.7)" }}>Bienvenue dans votre espace partenaire</div>
          </div>
          <div style={{ padding: "6px 16px", borderRadius: "20px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", color: "#e0e7ff", fontSize: "12px", fontWeight: 700 }}>
            🪙 {coins} coins
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginTop: "24px", position: "relative" }}>
          {[
            { label: "Clients actifs", value: "0", unit: "" },
            { label: "Revenus ce mois", value: "0", unit: "coins" },
            { label: "Taux de marge", value: "—", unit: "" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", padding: "16px 18px", backdropFilter: "blur(8px)" }}>
              <div style={{ fontSize: "12px", color: "rgba(199,210,254,0.7)", marginBottom: "4px" }}>{stat.label}</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1 }}>{stat.value} {stat.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "14px", padding: "6px", marginBottom: "24px", overflowX: "auto" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex: 1, padding: "10px 14px", borderRadius: "10px", border: "none",
            background: activeTab === tab.id ? accent : "transparent",
            color: activeTab === tab.id ? "#09090B" : "#71717A",
            fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", whiteSpace: "nowrap",
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "28px" }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}>{f.icon}</div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>{f.title}</h4>
                <p style={{ fontSize: "12px", color: "#52525B" }}>{f.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "12px" }}>🚀 Comment démarrer ?</h2>
            <ol style={{ paddingLeft: "20px", color: "#A1A1AA", fontSize: "14px", lineHeight: 2.2 }}>
              <li>Achetez un pack revendeur avec vos coins FLYHOST</li>
              <li>Accédez au tableau de bord de gestion de vos clients</li>
              <li>Créez des serveurs pour vos clients en quelques clics</li>
              <li>Facturez vos clients au prix que vous choisissez</li>
              <li>Empoche la différence entre le prix FLYHOST et votre tarif</li>
            </ol>
          </div>
        </div>
      )}

      {/* Plans Tab */}
      {activeTab === "plans" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
            {RESELLER_PLANS.map(plan => (
              <div key={plan.id} style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", padding: "28px" }}>
                <div style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>{plan.name}</div>
                <div style={{ fontSize: "32px", fontWeight: 800, color: accent, marginBottom: "4px" }}>{plan.cost} <span style={{ fontSize: "14px", fontWeight: 500, color: "#71717A" }}>coins</span></div>
                <div style={{ display: "inline-flex", background: "rgba(16,185,129,0.12)", color: green, borderRadius: "50px", padding: "4px 12px", fontSize: "13px", fontWeight: 700, marginBottom: "20px" }}>
                  Marge {plan.margin}
                </div>
                <ul style={{ listStyle: "none", padding: 0, marginBottom: "24px" }}>
                  {[
                    `${plan.servers} crédits serveur`,
                    `Marge de ${plan.margin} sur les renouvellements`,
                    "Dashboard client inclus",
                    "Support prioritaire",
                  ].map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", padding: "6px 0", borderBottom: `1px solid ${border}` }}>
                      <span style={{ color: green }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    if (coins < plan.cost) {
                      showToast(`Coins insuffisants. Vous avez ${coins}, besoin de ${plan.cost}`, "error");
                    } else {
                      showToast("Fonctionnalité bientôt disponible !", "info");
                    }
                  }}
                  style={{ width: "100%", padding: "14px", background: accent, border: "none", color: "#09090B", borderRadius: "14px", fontWeight: 700, fontSize: "15px", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Acheter ce pack
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === "clients" && (
        <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "40px", textAlign: "center", color: "#52525B" }}>
          <div style={{ fontSize: "56px", marginBottom: "16px" }}>👥</div>
          <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#A1A1AA", marginBottom: "8px" }}>Aucun client pour l'instant</h3>
          <p style={{ fontSize: "14px", marginBottom: "20px" }}>Achetez un pack revendeur pour commencer à gérer des clients</p>
          <button onClick={() => setActiveTab("plans")} style={{ padding: "12px 24px", background: accent, border: "none", color: "#09090B", borderRadius: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Voir les packs →
          </button>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {[
            { label: "Revenus totaux", value: "0 🪙", color: accent, icon: "💰" },
            { label: "Clients actifs", value: "0", color: green, icon: "👥" },
            { label: "Serveurs vendus", value: "0", color: blue, icon: "🖥️" },
            { label: "Taux de rétention", value: "—", color: warning, icon: "📈" },
          ].map(s => (
            <div key={s.label} style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "22px", textAlign: "center" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>{s.icon}</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: s.color, marginBottom: "4px" }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "#52525B", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </FlyLayout>
  );
}
