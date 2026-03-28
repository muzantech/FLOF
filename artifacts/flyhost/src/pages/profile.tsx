import { useState, useEffect } from "react";
import { FlyLayout } from "@/components/fly-layout";
import { useAuth } from "@/hooks/use-auth";

const accent = "#FACC15";
const accentDim = "rgba(250,204,21,0.10)";
const border = "rgba(250,204,21,0.14)";
const green = "#10b981";
const error = "#ef4444";
const surface = "rgba(18,18,22,0.90)";
const surfaceStrong = "rgba(28,28,35,0.97)";

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "20px", padding: "26px", ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "12px", borderBottom: `1px solid ${border}` }}>
      <span style={{ fontSize: "20px" }}>{icon}</span>
      <h2 style={{ fontSize: "17px", fontWeight: 800 }}>{title}</h2>
    </div>
  );
}

export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [sub, setSub] = useState<any>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
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
          setName(d.user.name || "");
          setBio(d.user.bio || "");
          setSub(d.subscription);
          setReferralCount(d.referralCount || 0);
        }
      } catch {}
    }
    load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio }),
      });
      if (res.ok) {
        showToast("Profil mis à jour ✓", "success");
      } else {
        showToast("Erreur lors de la mise à jour", "error");
      }
    } catch {
      showToast("Erreur réseau", "error");
    }
    setSaving(false);
  }

  const initials = (profile?.name || authUser?.name || "?").charAt(0).toUpperCase();
  const joinDate = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("fr-FR", { year: "numeric", month: "long" }) : "—";

  return (
    <FlyLayout title="Mon Profil">
      {toast && (
        <div style={{ position: "fixed", top: "80px", right: "20px", zIndex: 9999, padding: "12px 18px", background: surfaceStrong, border: `1px solid ${border}`, borderRadius: "12px", fontSize: "14px", fontWeight: 600, borderLeft: `4px solid ${toast.type === "success" ? green : toast.type === "error" ? error : accent}` }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: 800, letterSpacing: "-1px", marginBottom: "6px" }}>Mon Profil</h1>
        <p style={{ color: "#71717A", fontSize: "16px" }}>Gérez vos informations, votre sécurité et vos préférences.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Identity card */}
          <Card>
            <CardHeader title="Informations personnelles" icon="👤" />
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "24px" }}>
              <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: `linear-gradient(135deg,${accent},#CA8A04)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", fontWeight: 800, color: "#09090B", flexShrink: 0 }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: "20px", fontWeight: 800 }}>{profile?.name || authUser?.name}</div>
                <div style={{ color: "#71717A", fontSize: "14px" }}>@{profile?.username || authUser?.username}</div>
                <div style={{ display: "inline-block", marginTop: "6px", padding: "3px 10px", borderRadius: "20px", background: accentDim, color: accent, fontSize: "12px", fontWeight: 700 }}>
                  {profile?.role === "admin" ? "👑 Admin" : profile?.role === "superadmin" ? "⚡ Super Admin" : "👤 Membre"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#71717A", marginBottom: "6px" }}>Nom d'affichage</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: "10px", color: "#FAFAFA", fontFamily: "inherit", fontSize: "14px", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#71717A", marginBottom: "6px" }}>Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${border}`, borderRadius: "10px", color: "#FAFAFA", fontFamily: "inherit", fontSize: "14px", outline: "none", resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#71717A", marginBottom: "6px" }}>Email</label>
                <input
                  value={profile?.email || authUser?.email || ""}
                  readOnly
                  style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: "10px", color: "#71717A", fontFamily: "inherit", fontSize: "14px", outline: "none", cursor: "not-allowed" }}
                />
              </div>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{ padding: "12px 20px", background: accent, color: "#09090B", border: "none", borderRadius: "12px", fontWeight: 700, fontSize: "14px", cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}
              >
                {saving ? "⏳ Enregistrement..." : "💾 Sauvegarder"}
              </button>
            </div>
          </Card>

          {/* Security card */}
          <Card>
            <CardHeader title="Sécurité" icon="🔐" />
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { label: "Mot de passe", value: "Dernière modification: jamais", btn: "Changer" },
                { label: "Authentification 2FA", value: "Non activée", btn: "Activer" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: "12px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{item.label}</div>
                    <div style={{ fontSize: "12px", color: "#71717A", marginTop: "2px" }}>{item.value}</div>
                  </div>
                  <button style={{ padding: "8px 14px", background: "transparent", border: `1px solid ${border}`, color: "#A1A1AA", borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 600 }}>
                    {item.btn}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* API Key */}
          <Card>
            <CardHeader title="Clé API" icon="🔑" />
            <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: "12px", fontFamily: "monospace", fontSize: "13px", color: accent, wordBreak: "break-all", marginBottom: "12px" }}>
              {profile?.referralCode ? `flyhost_key_${profile.referralCode.toLowerCase()}_${"x".repeat(24)}` : "Chargement..."}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ padding: "8px 14px", background: accentDim, border: `1px solid ${border}`, color: accent, borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 600 }}>
                📋 Copier
              </button>
              <button style={{ padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: `1px solid rgba(239,68,68,0.3)`, color: error, borderRadius: "8px", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 600 }}>
                🔄 Régénérer
              </button>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Stats card */}
          <Card>
            <CardHeader title="Statistiques" icon="📊" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: "Coins", value: profile?.coins ?? "—", icon: "🪙", color: accent },
                { label: "Parrainages", value: referralCount, icon: "👥", color: green },
                { label: "Plan actif", value: sub ? sub.planName.charAt(0).toUpperCase() + sub.planName.slice(1) : "Gratuit", icon: "💎", color: "#A78BFA" },
                { label: "Membre depuis", value: joinDate, icon: "📅", color: "#71717A" },
              ].map(stat => (
                <div key={stat.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: "12px", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "22px", marginBottom: "6px" }}>{stat.icon}</div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: stat.color, marginBottom: "2px" }}>{stat.value}</div>
                  <div style={{ fontSize: "11px", color: "#52525B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Subscription card */}
          <Card>
            <CardHeader title="Abonnement actuel" icon="💎" />
            {sub ? (
              <div>
                <div style={{ padding: "16px", background: `linear-gradient(135deg,rgba(250,204,21,0.15),rgba(234,88,12,0.1))`, border: "1px solid rgba(250,204,21,0.3)", borderRadius: "12px", marginBottom: "12px" }}>
                  <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "4px" }}>🚀 Plan {sub.planName}</div>
                  <div style={{ fontSize: "13px", color: "#71717A" }}>{sub.pricePerMonth} coins/mois • +{sub.bonusCoins} bonus</div>
                </div>
                <a href="/subscription" style={{ display: "block", textAlign: "center", padding: "10px", background: accentDim, border: `1px solid ${border}`, borderRadius: "10px", color: accent, textDecoration: "none", fontSize: "13px", fontWeight: 700 }}>
                  Gérer mon abonnement →
                </a>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>🆓</div>
                <p style={{ color: "#71717A", fontSize: "14px", marginBottom: "12px" }}>Aucun abonnement actif</p>
                <a href="/subscription" style={{ display: "block", padding: "10px", background: accent, borderRadius: "10px", color: "#09090B", textDecoration: "none", fontSize: "14px", fontWeight: 700, textAlign: "center" }}>
                  Voir les plans →
                </a>
              </div>
            )}
          </Card>

          {/* Referral card */}
          <Card>
            <CardHeader title="Code de parrainage" icon="🎁" />
            <p style={{ fontSize: "13px", color: "#71717A", marginBottom: "12px" }}>Partagez ce code et gagnez 50 coins par ami invité !</p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: "10px", marginBottom: "12px" }}>
              <span style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: 700, color: accent, flex: 1, letterSpacing: "0.1em" }}>
                {profile?.referralCode || "CHARGEMENT..."}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(profile?.referralCode || "")}
                style={{ background: accentDim, border: `1px solid ${border}`, color: accent, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: 700 }}
              >
                📋
              </button>
            </div>
            <a href="/referral" style={{ display: "block", textAlign: "center", padding: "10px", background: "rgba(255,255,255,0.03)", border: `1px solid ${border}`, borderRadius: "10px", color: "#A1A1AA", textDecoration: "none", fontSize: "13px", fontWeight: 600 }}>
              Voir mes parrainages ({referralCount}) →
            </a>
          </Card>
        </div>
      </div>
    </FlyLayout>
  );
}
