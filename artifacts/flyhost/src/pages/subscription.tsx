import { useState, useEffect } from "react";
import { FlyLayout } from "@/components/fly-layout";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const error = "#ef4444";

const FCFA_TO_USD = 600;
function toUsd(fcfa: number) {
  return (fcfa / FCFA_TO_USD).toFixed(2);
}

const PLANS = [
  {
    id: "starter", name: "🌱 Starter", priceFcfa: 500, bonus: 100, durationDays: 14,
    features: ["100 coins bonus à l'activation", "1 serveur gratuit par période", "Support prioritaire", "Badge Starter"],
    popular: false,
  },
  {
    id: "pro", name: "🚀 Pro", priceFcfa: 1500, bonus: 350, durationDays: 14,
    features: ["350 coins bonus à l'activation", "3 serveurs gratuits par période", "Support VIP", "Auto-renew inclus", "Badge Pro exclusif"],
    popular: true,
  },
  {
    id: "business", name: "💼 Business", priceFcfa: 4000, bonus: 1000, durationDays: 30,
    features: ["1000 coins bonus à l'activation", "Serveurs illimités", "Support 24/7 dédié", "Tableau de bord business", "API illimitée", "Badge Business doré"],
    popular: false,
  },
];

const COMPARE_ROWS = [
  ["Durée de validité", "—", "14 jours", "14 jours", "30 jours"],
  ["Coins bonus", "—", "100 🪙", "350 🪙", "1000 🪙"],
  ["Serveurs gratuits/période", "—", "1", "3", "Illimités"],
  ["Support", "Standard", "Prioritaire", "VIP", "24/7 dédié"],
  ["Auto-renouvellement", "—", "—", "✓", "✓"],
  ["Badge exclusif", "—", "🌱", "🚀", "💼"],
  ["API illimitée", "—", "—", "—", "✓"],
  ["Domaines custom", "—", "—", "—", "✓"],
  ["Déploiements GitHub", "✓", "✓", "✓", "✓"],
];

export default function SubscriptionPage() {
  const [sub, setSub] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState<string | null>(null);

  function showToast(msg: string, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    fetch("/api/subscriptions/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setSub(d.subscription))
      .catch(() => {});
  }, []);

  async function subscribe(planId: string) {
    setLoading(planId);
    try {
      const res = await fetch("/api/payment/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (res.ok && data.paymentUrl) {
        setRedirecting(planId);
        showToast("Redirection vers le paiement...", "info");
        setTimeout(() => { window.location.href = data.paymentUrl; }, 1200);
      } else {
        showToast(data.error || "Erreur lors de l'initiation du paiement", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
    setLoading(null);
  }

  async function cancelSub() {
    if (!confirm("Résilier votre abonnement ?")) return;
    const res = await fetch("/api/subscriptions/cancel", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast("Abonnement résilié.", "info");
      setTimeout(() => window.location.reload(), 1500);
    }
  }

  const planLabels: Record<string, string> = { starter: "🌱 Starter", pro: "🚀 Pro", business: "💼 Business" };

  return (
    <FlyLayout title="Abonnement">
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 9999, padding: "12px 18px", background: "rgba(28,28,35,0.97)", border: `1px solid ${border}`, borderRadius: "12px", fontSize: "14px", fontWeight: 600, borderLeft: `4px solid ${toast.type === "success" ? green : toast.type === "error" ? error : accent}` }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, marginBottom: "10px" }}>💎 Plans d'Abonnement</h1>
        <p style={{ color: "#71717A", fontSize: "16px", marginBottom: "16px" }}>
          Paiement sécurisé via MoneyFusion · Prix en FCFA · Activation immédiate
        </p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(16,185,129,0.1)", color: green, borderRadius: "50px", padding: "8px 20px", fontWeight: 700, fontSize: "14px", border: "1px solid rgba(16,185,129,0.3)" }}>
          🔒 Paiement 100% sécurisé · MoneyFusion
        </div>
      </div>

      {/* Current Sub */}
      {sub && (
        <div style={{ background: "linear-gradient(135deg,rgba(250,204,21,0.15),rgba(234,88,12,0.1))", border: "1px solid rgba(250,204,21,0.4)", borderRadius: "18px", padding: "24px", marginBottom: "40px", display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "48px" }}>✅</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px" }}>Abonnement actif : {planLabels[sub.planName] || sub.planName}</h3>
            <p style={{ color: "#71717A" }}>
              Expire le : {sub.nextBillingAt ? new Date(sub.nextBillingAt).toLocaleDateString("fr-FR") : "N/A"} · {sub.pricePerMonth} FCFA
            </p>
          </div>
          <button onClick={cancelSub} style={{ background: "transparent", border: `1px solid ${error}`, color: error, borderRadius: "12px", padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 600 }}>
            ✕ Résilier
          </button>
        </div>
      )}

      {/* Plans */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "24px", marginBottom: "48px" }}>
        {PLANS.map(plan => {
          const isActive = sub?.planName === plan.id && sub?.isActive;
          const isLoading = loading === plan.id || redirecting === plan.id;
          return (
            <div key={plan.id} style={{
              background: plan.popular ? "linear-gradient(135deg,rgba(250,204,21,0.08),rgba(234,88,12,0.05))" : "rgba(28,28,35,0.97)",
              border: `2px solid ${plan.popular ? accent : border}`,
              borderRadius: "24px", padding: "28px", position: "relative",
            }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: accent, color: "#09090B", borderRadius: "50px", padding: "4px 16px", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>
                  ⭐ Le plus populaire
                </div>
              )}
              <div style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>{plan.name}</div>

              {/* Price block */}
              <div style={{ marginBottom: "4px" }}>
                <span style={{ fontSize: "40px", fontWeight: 800, color: accent }}>{plan.priceFcfa.toLocaleString("fr-FR")}</span>
                <span style={{ fontSize: "16px", fontWeight: 700, color: accent, marginLeft: "4px" }}>FCFA</span>
              </div>
              <div style={{ fontSize: "15px", color: "#71717A", fontWeight: 500, marginBottom: "8px" }}>
                ≈ ${toUsd(plan.priceFcfa)} USD
              </div>

              {/* Duration badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(16,185,129,0.12)", color: green, borderRadius: "50px", padding: "4px 12px", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
                ⏱ {plan.durationDays} jours
              </div>

              {/* Bonus badge */}
              <div style={{ display: "inline-flex", background: accentDim, color: accent, borderRadius: "50px", padding: "4px 12px", fontSize: "13px", fontWeight: 700, marginBottom: "20px", marginLeft: "8px" }}>
                +{plan.bonus} coins bonus
              </div>

              <ul style={{ listStyle: "none", marginBottom: "24px", padding: 0 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", padding: "6px 0", borderBottom: `1px solid ${border}` }}>
                    <span style={{ color: green }}>✓</span> {f}
                  </li>
                ))}
              </ul>

              {isActive ? (
                <div style={{ width: "100%", padding: "14px", borderRadius: "14px", background: green, color: "white", fontWeight: 700, fontSize: "15px", textAlign: "center" }}>✓ Plan actif</div>
              ) : (
                <button
                  onClick={() => subscribe(plan.id)}
                  disabled={isLoading}
                  style={{
                    width: "100%", padding: "14px", borderRadius: "14px", border: plan.popular ? "none" : `2px solid ${accent}`,
                    background: plan.popular ? accent : "transparent",
                    color: plan.popular ? "#09090B" : accent,
                    fontWeight: 700, fontSize: "15px", cursor: isLoading ? "not-allowed" : "pointer", fontFamily: "inherit",
                    opacity: isLoading ? 0.7 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  {redirecting === plan.id ? "⏳ Redirection..." : loading === plan.id ? "⏳ En cours..." : `Payer ${plan.priceFcfa.toLocaleString("fr-FR")} FCFA`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "24px", textAlign: "center" }}>📊 Comparaison des plans</h2>
        <div style={{ background: "rgba(28,28,35,0.97)", border: `1px solid ${border}`, borderRadius: "20px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: accentDim }}>
                <th style={{ padding: "16px 20px", textAlign: "left", fontWeight: 700 }}>Fonctionnalité</th>
                <th style={{ padding: "16px", textAlign: "center", fontWeight: 700 }}>🆓 Gratuit</th>
                <th style={{ padding: "16px", textAlign: "center", fontWeight: 700 }}>🌱 Starter</th>
                <th style={{ padding: "16px", textAlign: "center", fontWeight: 700, color: accent, background: "rgba(250,204,21,0.12)" }}>🚀 Pro</th>
                <th style={{ padding: "16px", textAlign: "center", fontWeight: 700 }}>💼 Business</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${border}`, background: i % 2 === 0 ? "rgba(250,204,21,0.02)" : "transparent" }}>
                  <td style={{ padding: "14px 20px", fontWeight: 600, color: "#A1A1AA" }}>{row[0]}</td>
                  {row.slice(1).map((cell, j) => (
                    <td key={j} style={{ padding: "14px", textAlign: "center", background: j === 2 ? "rgba(250,204,21,0.05)" : "transparent", color: cell === "✓" ? green : cell === "—" ? "#52525B" : "#FAFAFA" }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing summary */}
      <div style={{ background: "rgba(28,28,35,0.97)", border: `1px solid ${border}`, borderRadius: "20px", padding: "24px", marginBottom: "48px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "16px", textAlign: "center" }}>💱 Récapitulatif des prix</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ textAlign: "center", padding: "16px", background: "rgba(250,204,21,0.05)", borderRadius: "14px", border: `1px solid ${border}` }}>
              <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "4px" }}>{plan.name}</div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: accent }}>{plan.priceFcfa.toLocaleString("fr-FR")} FCFA</div>
              <div style={{ fontSize: "14px", color: "#71717A" }}>${toUsd(plan.priceFcfa)} USD</div>
              <div style={{ fontSize: "13px", color: green, marginTop: "4px" }}>⏱ {plan.durationDays} jours</div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "20px", textAlign: "center" }}>❓ Questions fréquentes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            { q: "Combien de temps dure un abonnement ?", a: "Les plans Starter et Pro sont valables 14 jours. Le plan Business est valable 30 jours. Le renouvellement se fait via un nouveau paiement MoneyFusion." },
            { q: "Quels moyens de paiement sont acceptés ?", a: "Le paiement se fait via MoneyFusion, qui accepte les paiements mobile money (Orange Money, MTN, Wave, etc.) et autres méthodes disponibles dans votre pays." },
            { q: "Comment fonctionnent les coins bonus ?", a: "Les coins bonus sont crédités immédiatement sur votre compte après confirmation du paiement. Ils peuvent être utilisés pour créer et gérer des serveurs." },
            { q: "Est-ce que je peux annuler à tout moment ?", a: "Oui, vous pouvez résilier votre abonnement depuis la page d'abonnement. L'abonnement reste actif jusqu'à sa date d'expiration." },
            { q: "Puis-je changer de plan ?", a: "Oui. Souscrivez à un nouveau plan à tout moment. L'ancien abonnement sera remplacé et le nouveau prendra effet immédiatement." },
          ].map((faq, i) => (
            <details key={i} style={{ background: "rgba(28,28,35,0.97)", border: `1px solid ${border}`, borderRadius: "14px", padding: "18px 20px", cursor: "pointer" }}>
              <summary style={{ fontWeight: 700, fontSize: "15px", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {faq.q} <span>▼</span>
              </summary>
              <p style={{ marginTop: "12px", color: "#71717A", lineHeight: 1.6, fontSize: "14px" }}>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </FlyLayout>
  );
}
