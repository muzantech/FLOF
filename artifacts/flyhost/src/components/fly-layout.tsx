import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/projects", label: "Projets", icon: "📁" },
  { href: "/deploy", label: "Déployer", icon: "🚀" },
  { href: "/teams", label: "Équipes", icon: "👥" },
  { href: "/referral", label: "Parrainage", icon: "🎁" },
  { href: "/subscription", label: "Abonnement", icon: "💎" },
  { href: "/invoices", label: "Factures", icon: "🧾" },
  { href: "/history", label: "Historique", icon: "📜" },
  { href: "/profile", label: "Mon Profil", icon: "👤" },
  { href: "/settings", label: "Paramètres", icon: "⚙️" },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Espace Revendeur", icon: "🏪" },
  { href: "/docs", label: "Documentation", icon: "📚" },
  { href: "/status", label: "Status", icon: "🟢" },
];

export function FlyLayout({ children, title }: { children: ReactNode; title?: string }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const initials = user?.name?.charAt(0).toUpperCase() || "?";

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", background: "#09090B", color: "#FAFAFA", minHeight: "100vh", position: "relative" }}>
      {/* Animated BG */}
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: -2, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", width: "600px", height: "600px", borderRadius: "50%", background: "rgba(250,204,21,0.4)", filter: "blur(100px)", opacity: 0.2, top: "-200px", left: "-100px" }} />
        <div style={{ position: "absolute", width: "500px", height: "500px", borderRadius: "50%", background: "rgba(234,88,12,0.4)", filter: "blur(100px)", opacity: 0.2, bottom: "-150px", right: "-100px" }} />
      </div>

      {/* Overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 199 }}
        />
      )}

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, left: 0, width: "280px", height: "100vh",
        background: "rgba(12,12,16,0.98)", backdropFilter: "blur(24px)",
        borderRight: "1px solid rgba(250,204,21,0.14)",
        boxShadow: "4px 0 40px rgba(250,204,21,0.1)",
        zIndex: 200,
        transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column", overflowY: "auto",
      }}>
        {/* Drawer header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 16px", borderBottom: "1px solid rgba(250,204,21,0.14)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#FACC15", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "14px", color: "#09090B" }}>F</div>
            <span style={{ fontWeight: 800, fontSize: "18px" }}>FLYHOST</span>
          </div>
          <button onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: "none", color: "#52525B", cursor: "pointer", fontSize: "22px", padding: "4px" }}>✕</button>
        </div>

        {/* User info */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "20px", borderBottom: "1px solid rgba(250,204,21,0.14)" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "linear-gradient(135deg,#FACC15,#CA8A04)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "20px", color: "#09090B", flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "15px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "Utilisateur"}</div>
            <div style={{ fontSize: "12px", color: "#52525B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#52525B", padding: "12px 8px 6px" }}>Navigation</div>
          {NAV_ITEMS.map(item => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "10px",
                  background: isActive ? "#FACC15" : "transparent",
                  color: isActive ? "#09090B" : "#A1A1AA",
                  fontWeight: 600, fontSize: "14px", cursor: "pointer", marginBottom: "2px",
                  transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: "16px" }}>{item.icon}</span>
                  {item.label}
                </div>
              </Link>
            );
          })}
          <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#52525B", padding: "16px 8px 6px" }}>Ressources</div>
          {ADMIN_ITEMS.map(item => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setDrawerOpen(false)}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px", padding: "11px 14px", borderRadius: "10px",
                  background: isActive ? "#FACC15" : "transparent",
                  color: isActive ? "#09090B" : "#A1A1AA",
                  fontWeight: 600, fontSize: "14px", cursor: "pointer", marginBottom: "2px",
                  transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: "16px" }}>{item.icon}</span>
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(250,204,21,0.14)" }}>
          <button onClick={logout} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            width: "100%", padding: "12px", borderRadius: "30px",
            background: "rgba(239,68,68,0.1)", border: "none",
            color: "#ef4444", fontWeight: 700, fontSize: "14px",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            🚪 Déconnexion
          </button>
        </div>
      </div>

      {/* Topbar */}
      <header style={{
        position: "fixed", top: 0, width: "100%", height: "64px",
        background: "rgba(9,9,11,0.95)", borderTop: "3px solid #FACC15",
        zIndex: 90, display: "flex", alignItems: "center", padding: "0 24px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}>
        {/* Hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: "5px", marginRight: "16px", padding: "8px", borderRadius: "8px" }}
        >
          <span style={{ display: "block", width: "22px", height: "2px", background: "white", borderRadius: "2px" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "white", borderRadius: "2px" }} />
          <span style={{ display: "block", width: "22px", height: "2px", background: "white", borderRadius: "2px" }} />
        </button>

        {/* Logo */}
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", flex: 1 }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "#FACC15", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "15px", color: "#09090B" }}>F</div>
          <span style={{ fontWeight: 800, fontSize: "18px", color: "white" }}>FLYHOST</span>
          {title && <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 8px" }}>/</span>}
          {title && <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "15px", fontWeight: 600 }}>{title}</span>}
        </Link>

        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
          <Link href="/profile">
            <div style={{
              width: "38px", height: "38px", borderRadius: "50%",
              background: "#FACC15", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, fontSize: "15px", color: "#09090B",
              cursor: "pointer", border: "2px solid rgba(255,255,255,0.2)",
            }}>
              {initials}
            </div>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main style={{ paddingTop: "80px", maxWidth: "1200px", margin: "0 auto", padding: "80px 24px 48px", position: "relative", zIndex: 5 }}>
        {children}
      </main>
    </div>
  );
}
