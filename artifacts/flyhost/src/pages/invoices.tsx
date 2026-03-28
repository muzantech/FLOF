import { useState, useEffect } from "react";
import { FlyLayout } from "@/components/fly-layout";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const error = "#ef4444";
const warning = "#f59e0b";
const surfaceStrong = "rgba(28,28,35,0.97)";

const CATEGORY_ICONS: Record<string, string> = {
  subscription: "💎", subscription_bonus: "🎁", referral: "👥",
  welcome: "🎉", daily_login: "☀️", deployment: "🚀", purchase: "🛒", default: "🪙",
};

const CATEGORY_LABELS: Record<string, string> = {
  subscription: "Abonnement", subscription_bonus: "Bonus abonnement", referral: "Parrainage",
  welcome: "Bonus bienvenue", daily_login: "Connexion quotidienne", deployment: "Déploiement",
  purchase: "Achat", default: "Transaction",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, paid: 0, totalSpent: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "debit" | "credit">("all");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/invoices");
        if (res.ok) {
          const d = await res.json();
          setInvoices(d.invoices || []);
          setStats(d.stats || { total: 0, paid: 0, totalSpent: 0 });
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filtered = invoices.filter(inv => filter === "all" ? true : inv.type === filter);

  return (
    <FlyLayout title="Factures">
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>
          🧾 Mes <span style={{ color: accent }}>Factures</span>
        </h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Historique de vos transactions et reçus</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        {[
          { label: "Total transactions", value: stats.total, icon: "📄", color: "#FAFAFA" },
          { label: "Débits", value: stats.paid, icon: "📤", color: error },
          { label: "Total dépensé", value: `${stats.totalSpent} 🪙`, icon: "🪙", color: warning },
        ].map(stat => (
          <div key={stat.label} style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "20px" }}>
            <div style={{ fontSize: "13px", color: "#52525B", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>{stat.icon}</span> {stat.label}
            </div>
            <div style={{ fontSize: "26px", fontWeight: 800, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {(["all", "debit", "credit"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "8px 18px", borderRadius: "20px", border: `1px solid ${filter === f ? accent : border}`,
            background: filter === f ? accent : "transparent",
            color: filter === f ? "#09090B" : "#71717A",
            fontWeight: 600, fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
          }}>
            {f === "all" ? "Toutes" : f === "debit" ? "📤 Débits" : "📥 Crédits"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#52525B" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.4 }}>📄</div>
          <p>Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#52525B", background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.4 }}>📭</div>
          <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px", color: "#FAFAFA" }}>Aucune transaction</h3>
          <p style={{ fontSize: "13px" }}>Vos transactions apparaîtront ici.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map((inv: any) => {
            const icon = CATEGORY_ICONS[inv.category] || CATEGORY_ICONS.default;
            const label = CATEGORY_LABELS[inv.category] || inv.category;
            const isCredit = inv.type === "credit";
            return (
              <div key={inv.id} style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "16px", transition: "all 0.2s" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0, background: isCredit ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.description}</div>
                  <div style={{ fontSize: "13px", color: "#52525B", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <span>📂 {label}</span>
                    <span>📅 {new Date(inv.createdAt).toLocaleDateString("fr-FR")}</span>
                    {inv.reference && <span style={{ fontFamily: "monospace" }}>#{inv.reference}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: isCredit ? green : error }}>
                    {isCredit ? "+" : "-"}{inv.amount} 🪙
                  </div>
                  <div style={{ marginTop: "4px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px",
                      borderRadius: "50px", fontSize: "11px", fontWeight: 700,
                      background: isCredit ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                      color: isCredit ? green : error,
                    }}>
                      {isCredit ? "✓ Crédit" : "↑ Débit"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FlyLayout>
  );
}
