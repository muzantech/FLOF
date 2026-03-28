import { FlyLayout } from "@/components/fly-layout";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const surfaceStrong = "rgba(28,28,35,0.97)";
const warning = "#f59e0b";

const SERVICES = [
  { name: "API FLYHOST", status: "operational", uptime: "99.98%", latency: "42ms", icon: "🔌" },
  { name: "Déploiements", status: "operational", uptime: "99.95%", latency: "120ms", icon: "🚀" },
  { name: "Base de données", status: "operational", uptime: "99.99%", latency: "8ms", icon: "🗄️" },
  { name: "CDN / Fichiers", status: "operational", uptime: "99.97%", latency: "18ms", icon: "📡" },
  { name: "Authentification", status: "operational", uptime: "99.99%", latency: "25ms", icon: "🔐" },
  { name: "Tableau de bord", status: "operational", uptime: "99.96%", latency: "65ms", icon: "📊" },
  { name: "Webhooks", status: "degraded", uptime: "98.50%", latency: "380ms", icon: "🔔" },
  { name: "Emails", status: "operational", uptime: "99.90%", latency: "200ms", icon: "📧" },
];

const INCIDENTS = [
  { date: "26 Mars 2026", title: "Latence élevée sur les webhooks", status: "investigating", severity: "minor", desc: "Nous observons une augmentation de la latence sur notre système de webhooks. Nos ingénieurs enquêtent." },
  { date: "20 Mars 2026", title: "Maintenance planifiée API", status: "resolved", severity: "maintenance", desc: "Maintenance effectuée avec succès. Temps d'indisponibilité : 8 minutes." },
  { date: "15 Mars 2026", title: "Incident déploiements région EU-West", status: "resolved", severity: "major", desc: "Résolu. Les déploiements ont repris normalement après 23 minutes." },
];

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; label: string; bg: string }> = {
    operational: { color: green, label: "Opérationnel", bg: "rgba(16,185,129,0.12)" },
    degraded: { color: warning, label: "Dégradé", bg: "rgba(245,158,11,0.12)" },
    down: { color: "#ef4444", label: "En panne", bg: "rgba(239,68,68,0.12)" },
    investigating: { color: warning, label: "En investigation", bg: "rgba(245,158,11,0.12)" },
    resolved: { color: green, label: "Résolu", bg: "rgba(16,185,129,0.12)" },
    maintenance: { color: "#22D3EE", label: "Maintenance", bg: "rgba(34,211,238,0.12)" },
  };
  const c = configs[status] || configs.operational;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 12px", borderRadius: "50px", fontSize: "12px", fontWeight: 700, background: c.bg, color: c.color }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: c.color, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}

export default function StatusPage() {
  const allOperational = SERVICES.every(s => s.status === "operational");

  return (
    <FlyLayout title="Status">
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>🟢 Status FLYHOST</h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>État en temps réel de tous nos services</p>
      </div>

      {/* Global status */}
      <div style={{
        padding: "24px 28px", borderRadius: "20px", marginBottom: "32px",
        background: allOperational ? "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.06))" : "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.06))",
        border: `1px solid ${allOperational ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
        display: "flex", alignItems: "center", gap: "16px",
      }}>
        <span style={{ fontSize: "48px" }}>{allOperational ? "✅" : "⚠️"}</span>
        <div>
          <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "4px" }}>
            {allOperational ? "Tous les systèmes sont opérationnels" : "Certains services sont dégradés"}
          </h2>
          <p style={{ color: "#71717A", fontSize: "14px" }}>Dernière mise à jour : {new Date().toLocaleString("fr-FR")}</p>
        </div>
      </div>

      {/* Services */}
      <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", overflow: "hidden", marginBottom: "32px" }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${border}` }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800 }}>Services</h2>
        </div>
        {SERVICES.map((svc, i) => (
          <div key={svc.name} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 24px", borderBottom: i < SERVICES.length - 1 ? `1px solid ${border}` : "none" }}>
            <span style={{ fontSize: "20px" }}>{svc.icon}</span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: "15px" }}>{svc.name}</span>
            <span style={{ color: "#52525B", fontSize: "13px", marginRight: "8px" }}>
              {svc.latency} • {svc.uptime}
            </span>
            <StatusBadge status={svc.status} />
          </div>
        ))}
      </div>

      {/* Uptime graph (visual bars) */}
      <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", padding: "24px", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>📊 Disponibilité des 90 derniers jours</h2>
        {SERVICES.slice(0, 4).map(svc => (
          <div key={svc.name} style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{svc.name}</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: svc.status === "operational" ? green : warning }}>{svc.uptime}</span>
            </div>
            <div style={{ display: "flex", gap: "2px", height: "28px" }}>
              {Array.from({ length: 90 }).map((_, i) => {
                const isIncident = svc.name === "Webhooks" && (i === 4 || i === 5);
                return (
                  <div key={i} style={{
                    flex: 1, borderRadius: "2px",
                    background: isIncident ? "rgba(245,158,11,0.7)" : "rgba(16,185,129,0.7)",
                  }} title={`Jour ${90 - i}`} />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Incidents */}
      <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", padding: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>📋 Incidents récents</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {INCIDENTS.map((inc, i) => (
            <div key={i} style={{ padding: "18px 20px", background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: "14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>{inc.title}</div>
                  <div style={{ fontSize: "12px", color: "#52525B" }}>{inc.date}</div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{
                    padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700,
                    background: inc.severity === "major" ? "rgba(239,68,68,0.12)" : inc.severity === "maintenance" ? "rgba(34,211,238,0.12)" : "rgba(245,158,11,0.12)",
                    color: inc.severity === "major" ? "#ef4444" : inc.severity === "maintenance" ? "#22D3EE" : warning,
                  }}>{inc.severity}</span>
                  <StatusBadge status={inc.status} />
                </div>
              </div>
              <p style={{ fontSize: "13px", color: "#71717A", lineHeight: 1.6 }}>{inc.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </FlyLayout>
  );
}
