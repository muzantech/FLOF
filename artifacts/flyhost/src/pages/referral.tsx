import { useState, useEffect } from "react";
import { FlyLayout } from "@/components/fly-layout";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const error = "#ef4444";
const surfaceStrong = "rgba(28,28,35,0.97)";

export default function ReferralPage() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [applyCode, setApplyCode] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  function showToast(msg: string, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/referrals/my");
        if (res.ok) {
          const d = await res.json();
          setReferralCode(d.referralCode);
          setReferrals(d.referrals || []);
          setTotalEarned(d.totalEarned || 0);
        }
      } catch {}
    }
    load();
  }, []);

  function copyCode() {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast("Code copié ! ✓", "success");
  }

  function shareLink() {
    const url = `${window.location.origin}/register?ref=${referralCode}`;
    navigator.clipboard.writeText(url);
    showToast("Lien de parrainage copié !", "success");
  }

  async function handleApplyCode() {
    if (!applyCode.trim()) return;
    setApplying(true);
    try {
      const res = await fetch("/api/referrals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: applyCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Code appliqué ! +${data.coinsEarned} coins offerts 🎉`, "success");
        setApplyCode("");
      } else {
        showToast(data.error || "Code invalide", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
    setApplying(false);
  }

  return (
    <FlyLayout title="Parrainage">
      {toast && (
        <div style={{ position: "fixed", top: "80px", right: "20px", zIndex: 9999, padding: "12px 18px", background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "12px", fontSize: "14px", fontWeight: 600, borderLeft: `4px solid ${toast.type === "success" ? green : toast.type === "error" ? error : accent}` }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>🎁 Programme de Parrainage</h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Invitez vos amis et gagnez des coins pour chaque nouveau membre !</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
        {[
          { label: "Amis invités", value: referrals.length, icon: "👥", color: green },
          { label: "Coins gagnés", value: `${totalEarned} 🪙`, icon: "🪙", color: accent },
          { label: "Récompense/ami", value: "50 coins", icon: "🎁", color: "#A78BFA" },
          { label: "Votre bonus", value: "+25 coins", icon: "✨", color: "#22D3EE" },
        ].map(stat => (
          <div key={stat.label} style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "16px", padding: "20px", textAlign: "center" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>{stat.icon}</div>
            <div style={{ fontSize: "24px", fontWeight: 800, color: stat.color, marginBottom: "4px" }}>{stat.value}</div>
            <div style={{ fontSize: "12px", color: "#52525B", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "32px" }}>
        {/* Your code */}
        <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", padding: "26px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "6px" }}>🔗 Votre code de parrainage</h2>
          <p style={{ color: "#71717A", fontSize: "14px", marginBottom: "20px" }}>Partagez ce code unique avec vos amis. Vous recevrez 50 coins dès qu'ils s'inscrivent !</p>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px 18px", background: "rgba(250,204,21,0.06)", border: `2px solid ${border}`, borderRadius: "14px", marginBottom: "16px" }}>
            <span style={{ fontFamily: "monospace", fontSize: "22px", fontWeight: 800, color: accent, flex: 1, letterSpacing: "0.15em" }}>
              {referralCode || "CHARGEMENT..."}
            </span>
            <button onClick={copyCode} style={{ padding: "8px 14px", background: accentDim, border: `1px solid ${border}`, color: accent, borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 700 }}>
              {copied ? "✓ Copié !" : "📋 Copier"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={shareLink} style={{ flex: 1, padding: "12px", background: accent, border: "none", color: "#09090B", borderRadius: "12px", cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 700 }}>
              🔗 Partager le lien
            </button>
          </div>
        </div>

        {/* Apply code */}
        <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", padding: "26px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "6px" }}>✨ Entrer un code de parrainage</h2>
          <p style={{ color: "#71717A", fontSize: "14px", marginBottom: "20px" }}>Vous avez été parrainé ? Entrez le code de votre ami et gagnez 25 coins bonus !</p>
          
          <div style={{ marginBottom: "12px" }}>
            <input
              value={applyCode}
              onChange={e => setApplyCode(e.target.value.toUpperCase())}
              placeholder="Ex: JEAN12ABC"
              style={{ width: "100%", padding: "14px 16px", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: "12px", color: "#FAFAFA", fontFamily: "monospace", fontSize: "16px", fontWeight: 700, outline: "none", letterSpacing: "0.1em" }}
            />
          </div>
          <button
            onClick={handleApplyCode}
            disabled={applying || !applyCode.trim()}
            style={{ width: "100%", padding: "12px", background: applyCode.trim() ? green : "rgba(16,185,129,0.3)", border: "none", color: "white", borderRadius: "12px", cursor: applyCode.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", fontSize: "14px", fontWeight: 700 }}
          >
            {applying ? "⏳ Application..." : "🎁 Appliquer le code"}
          </button>

          <div style={{ marginTop: "20px", padding: "14px", background: "rgba(16,185,129,0.06)", border: `1px solid rgba(16,185,129,0.2)`, borderRadius: "12px" }}>
            <div style={{ fontSize: "13px", color: "#71717A", lineHeight: 1.6 }}>
              <span style={{ color: green, fontWeight: 700 }}>+25 coins</span> offerts pour vous<br />
              <span style={{ color: accent, fontWeight: 700 }}>+50 coins</span> offerts à votre parrain
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", padding: "26px", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>🚀 Comment ça marche ?</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          {[
            { step: "1", icon: "📋", title: "Copiez votre code", desc: "Partagez votre code unique avec vos amis" },
            { step: "2", icon: "👤", title: "L'ami s'inscrit", desc: "Votre ami créé son compte FLYHOST" },
            { step: "3", icon: "✨", title: "Code appliqué", desc: "Il entre votre code de parrainage" },
            { step: "4", icon: "🪙", title: "Coins crédités", desc: "+50 coins pour vous, +25 pour lui" },
          ].map(item => (
            <div key={item.step} style={{ textAlign: "center", padding: "16px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: accentDim, border: `2px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", margin: "0 auto 12px" }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{item.title}</div>
              <div style={{ fontSize: "12px", color: "#71717A" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral list */}
      <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", padding: "26px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>👥 Mes filleuls ({referrals.length})</h2>
        {referrals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#52525B" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🫂</div>
            <p style={{ fontSize: "15px", fontWeight: 600 }}>Aucun filleul pour l'instant</p>
            <p style={{ fontSize: "13px", marginTop: "6px" }}>Partagez votre code pour commencer à gagner des coins !</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {referrals.map((r: any) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                  {(r.referredName || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "14px" }}>{r.referredName || "Utilisateur"}</div>
                  <div style={{ fontSize: "12px", color: "#71717A" }}>@{r.referredUsername} • {new Date(r.createdAt).toLocaleDateString("fr-FR")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: green }}>+{r.rewardCoins} 🪙</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </FlyLayout>
  );
}
