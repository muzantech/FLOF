import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Triangle,
  LayoutDashboard,
  FolderGit2,
  Users,
  Settings,
  LogOut,
  Menu,
  Rocket,
  User,
  CreditCard,
  Gift,
  FileText,
  History,
  Activity,
  BookOpen,
  Shield,
  Coins,
  ChevronRight,
  X,
  Bell,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projets", icon: FolderGit2 },
  { href: "/teams", label: "Équipes", icon: Users },
  { href: "/deploy", label: "Déployer", icon: Rocket },
  { href: "/servers", label: "Serveurs", icon: Server },
];

const accountNavItems = [
  { href: "/profile", label: "Profil", icon: User },
  { href: "/subscription", label: "Abonnement", icon: CreditCard },
  { href: "/referral", label: "Parrainage", icon: Gift },
  { href: "/invoices", label: "Factures", icon: FileText },
  { href: "/history", label: "Historique", icon: History },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

const resourceNavItems = [
  { href: "/status", label: "Statut", icon: Activity },
  { href: "/docs", label: "Documentation", icon: BookOpen },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isActive = (href: string) => location === href || location.startsWith(href + "/");

  const NavLink = ({ item, onClick }: { item: { href: string; label: string; icon: any }; onClick?: () => void }) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
          active
            ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/25"
            : "text-zinc-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-yellow-400" : "group-hover:text-white"}`} />
        {item.label}
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-yellow-400" />}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col relative">
      {/* Animated orb background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] rounded-full bg-yellow-400/3 blur-[120px]" />
        <div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-yellow-400/2 blur-[120px]" />
      </div>

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-yellow-400/10 bg-[#09090B]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-yellow-400 flex items-center justify-center">
              <Triangle className="w-3.5 h-3.5 fill-black text-black" />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">FlyHost</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 ml-4">
            {mainNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active ? "text-yellow-400" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/* Coins Badge */}
            {user && (
              <Link href="/subscription">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-yellow-400/20 bg-yellow-400/5 hover:bg-yellow-400/10 transition-colors cursor-pointer">
                  <Coins className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-sm font-semibold text-yellow-400">{(user as any).coins ?? 0}</span>
                  <span className="text-xs text-yellow-400/60 font-medium">coins</span>
                </div>
              </Link>
            )}

            {/* Notification Bell (visual) */}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white">
              <Bell className="w-4 h-4" />
            </Button>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 rounded-full p-0 overflow-hidden border border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
                  {(user as any)?.avatarUrl ? (
                    <img src={(user as any).avatarUrl} alt={user?.name} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full bg-yellow-400/10 flex items-center justify-center text-xs font-bold text-yellow-400">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-60 bg-[#111] border-zinc-800" align="end">
                <DropdownMenuLabel className="font-normal pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-yellow-400/10 flex items-center justify-center border border-yellow-400/20">
                      <span className="text-sm font-bold text-yellow-400">{user?.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-none">{user?.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{user?.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400/80">
                    <Coins className="w-3 h-3" />
                    <span className="font-semibold">{(user as any)?.coins ?? 0} coins</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer flex items-center gap-2">
                    <User className="w-4 h-4" /> Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/subscription" className="cursor-pointer flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Abonnement
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/referral" className="cursor-pointer flex items-center gap-2">
                    <Gift className="w-4 h-4" /> Parrainage
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Paramètres
                  </Link>
                </DropdownMenuItem>
                {(user as any)?.role === "admin" || (user as any)?.role === "superadmin" ? (
                  <>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer flex items-center gap-2 text-yellow-400">
                        <Shield className="w-4 h-4" /> Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-400 cursor-pointer flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 text-zinc-400 hover:text-white"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-[280px] bg-[#0f0f0f] border-r border-yellow-400/10 flex flex-col overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-yellow-400/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-yellow-400 flex items-center justify-center">
                  <Triangle className="w-3.5 h-3.5 fill-black text-black" />
                </div>
                <span className="font-bold text-white">FlyHost</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={() => setDrawerOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* User info */}
            <div className="p-4 border-b border-zinc-800/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-yellow-400">{user?.name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{user?.name}</p>
                  <p className="text-xs text-zinc-400">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-400/5 border border-yellow-400/15">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-bold text-yellow-400">{(user as any)?.coins ?? 0} coins</span>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1">
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider px-3 mb-2">Navigation</p>
              {mainNavItems.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setDrawerOpen(false)} />
              ))}

              <div className="my-3 border-t border-zinc-800" />
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider px-3 mb-2">Compte</p>
              {accountNavItems.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setDrawerOpen(false)} />
              ))}

              <div className="my-3 border-t border-zinc-800" />
              <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider px-3 mb-2">Ressources</p>
              {resourceNavItems.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setDrawerOpen(false)} />
              ))}

              {(user as any)?.role === "admin" || (user as any)?.role === "superadmin" ? (
                <>
                  <div className="my-3 border-t border-zinc-800" />
                  <NavLink item={{ href: "/admin", label: "Admin Panel", icon: Shield }} onClick={() => setDrawerOpen(false)} />
                </>
              ) : null}
            </nav>

            {/* Logout */}
            <div className="p-3 border-t border-zinc-800">
              <button
                onClick={() => { setDrawerOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low coins alert banner */}
      {user && (user as any).coins < 50 && (
        <div className="relative z-10 w-full border-b border-yellow-400/20 bg-yellow-400/8">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-yellow-300">
              <Coins className="w-4 h-4 flex-shrink-0" />
              <span>
                Votre solde est bas (<strong>{(user as any).coins} coins</strong>).
                Rechargez maintenant pour éviter la suspension de vos serveurs.
              </span>
            </div>
            <Link href="/subscription" className="flex-shrink-0">
              <Button size="sm" className="h-7 text-xs font-semibold bg-yellow-400 text-black hover:bg-yellow-300 gap-1">
                <Coins className="w-3 h-3" /> Recharger
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      {/* WhatsApp Support Widget */}
      <a
        href="https://whatsapp.com/channel/0029VahusSh0QeaoFzHJCk2x"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-green-500/30"
        style={{ background: "#25D366", color: "#fff" }}
        title="Support WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="text-sm font-semibold hidden sm:inline">Support</span>
      </a>
    </div>
  );
}
