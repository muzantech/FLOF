import { useState, useEffect } from "react";
import { FlyLayout } from "@/components/fly-layout";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const error = "#ef4444";
const warning = "#f59e0b";
const surfaceStrong = "rgba(28,28,35,0.97)";

const CATEGORY_ICONS: Record<string, { icon: string; color: string }> = {
  subscription: { icon: "💎", color: "#A78BFA" },
  subscription_bonus: { icon: "🎁", color: green },
  referral: { icon: "👥", color: green },
  welcome: { icon: "🎉", color: accent },
  daily_login: { icon: "☀️", color: warning },
  deployment: { icon: "🚀", color: "#22D3EE" },
  purchase: { icon: "🛒", color: "#F97316" },
  default: { icon: "🪙", color: accent },
};

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totals, setTotals] = useState({ totalCredit: 0, totalDebit: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/history");
        if (res.ok) {
          const d = await res.json();
          setTransactions(d.transactions || []);
          setTotals(d.totals || { totalCredit: 0, totalDebit: 0 });
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filtered = transactions.filter(t => {
    if (filter === "credit" && t.type !== "credit") return false;
    if (filter === "debit" && t.type !== "debit") return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const balance = totals.totalCredit - totals.totalDebit;

  function groupByDate(items: any[]) {
    const groups: Record<string, any[]> = {};
    items.forEach(item => {
      const date = new Date(item.createdAt).toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return Object.entries(groups);
  }

  return (
    <FlyLayout title="Historique">
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>
          📜 Historique des transactions
        </h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Toutes vos activités et mouvements de coins</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "Solde net", value: `${balance >= 0 ? "+" : ""}${balance}`, icon: "💰", color: balance >= 0 ? green : error },
          { label: "Total reçu", value: `+${totals.totalCredit}`, icon: "📥", color: green },
          { label: "Total dépensé", value: `-${totals.totalDebit}`, icon: "📤", color: error },
          { label: "Transactions", value: transactions.length, icon: "📊", color: accent },
        ].map(stat => (
          <div key={stat.label} style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "14px", padding: "18px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>{stat.icon}</div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: stat.color, lineHeight: 1.1, marginBottom: "4px" }}>{stat.value} {stat.label !== "Transactions" ? "🪙" : ""}</div>
            <div style={{ fontSize: "11px", color: "#52525B", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        {["all", "credit", "debit"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "8px 16px", borderRadius: "20px", border: `1px solid ${filter === f ? accent : border}`,
            background: filter === f ? accent : "transparent",
            color: filter === f ? "#09090B" : "#71717A",
            fontWeight: 600, fontSize: "13px", cursor: "pointer", fontFamily: "inherit",
          }}>
            {f === "all" ? "Tous" : f === "credit" ? "📥 Crédits" : "📤 Débits"}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher..."
          style={{ flex: 1, minWidth: "150px", maxWidth: "280px", padding: "8px 16px", borderRadius: "20px", border: `1px solid ${border}`, background: surfaceStrong, color: "#FAFAFA", fontFamily: "inherit", fontSize: "13px", outline: "none" }}
        />
      </div>

      {/* Timeline */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#52525B" }}>
          <p>Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", color: "#52525B" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "20px", background: accentDim, border: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "28px" }}>📭</div>
          <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#A1A1AA", marginBottom: "6px" }}>Aucune transaction</h3>
          <p style={{ fontSize: "13px" }}>Vos transactions apparaîtront ici.</p>
        </div>
      ) : (
        <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", overflow: "hidden" }}>
          {groupByDate(filtered).map(([date, items]) => (
            <div key={date}>
              <div style={{ padding: "10px 20px", background: "rgba(250,204,21,0.04)", borderBottom: `1px solid ${border}`, fontSize: "12px", fontWeight: 700, color: "#52525B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {date}
              </div>
              {items.map((t: any) => {
                const cat = CATEGORY_ICONS[t.category] || CATEGORY_ICONS.default;
                const isCredit = t.type === "credit";
                return (
                  <div key={t.id} style={{ display: "flex", gap: "14px", padding: "16px 20px", borderBottom: `1px solid ${border}`, alignItems: "flex-start", transition: "background 0.15s" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0, marginTop: "1px", background: isCredit ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
                      <div style={{ color: "#52525B", fontSize: "12px", marginTop: "3px" }}>
                        {new Date(t.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        {t.reference && <span style={{ marginLeft: "8px", fontFamily: "monospace" }}>#{t.reference}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, minWidth: "80px" }}>
                      <div style={{ fontWeight: 800, fontSize: "16px", color: isCredit ? green : error }}>
                        {isCredit ? "+" : "-"}{t.amount} 🪙
                      </div>
                      <div style={{ fontSize: "11px", color: "#52525B", marginTop: "3px" }}>
                        {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </FlyLayout>
  );
}
