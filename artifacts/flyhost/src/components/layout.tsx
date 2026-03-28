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

      {/* Main Content */}
      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}
