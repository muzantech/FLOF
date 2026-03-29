import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Server,
  Users,
  BarChart3,
  Coins,
  ExternalLink,
  RefreshCw,
  Play,
  Square,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ShoppingBag,
  Activity,
  Database,
  Zap,
  Ban,
  UserCheck,
  UserX,
  Crown,
  MinusCircle,
  PlusCircle,
} from "lucide-react";

const RESELLER_PLANS = [
  { id: "starter", name: "Pack Starter", emoji: "🌱", cost: 1000, margin: "10%", servers: 5 },
  { id: "pro", name: "Pack Pro", emoji: "🚀", cost: 3000, margin: "15%", servers: 20 },
  { id: "business", name: "Pack Business", emoji: "💼", cost: 8000, margin: "20%", servers: 100 },
];

interface PteroServer {
  id: number;
  uuid: string;
  identifier: string;
  name: string;
  status: string | null;
  suspended: boolean;
  limits: { memory: number; disk: number; cpu: number };
  allocation?: { ip: string; port: number };
  createdAt: string;
}

function fmt(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} Go` : `${mb} Mo`;
}

function ServerStatus({ status, suspended }: { status: string | null; suspended: boolean }) {
  if (suspended) return <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Suspendu</Badge>;
  if (!status || status === "installing") return <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20 text-xs animate-pulse">Installation</Badge>;
  return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">Actif</Badge>;
}

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  // Pterodactyl data
  const [pteroServers, setPteroServers] = useState<PteroServer[]>([]);
  const [pteroStatus, setPteroStatus] = useState<any>(null);
  const [pteroLoading, setPteroLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Users management
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [coinsModal, setCoinsModal] = useState<{ userId: number; name: string; coins: number } | null>(null);
  const [coinsAmount, setCoinsAmount] = useState("");

  const coins = (user as any)?.coins ?? 0;

  async function loadPteroData() {
    setPteroLoading(true);
    try {
      const [statusRes, serversRes] = await Promise.all([
        fetch("/api/ptero/test"),
        fetch("/api/servers"),
      ]);
      if (statusRes.ok) setPteroStatus(await statusRes.json());
      if (serversRes.ok) {
        const d = await serversRes.json();
        setPteroServers(d.servers || []);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur Pterodactyl", description: e.message });
    }
    setPteroLoading(false);
  }

  useEffect(() => {
    if (activeTab === "pterodactyl") loadPteroData();
    if (activeTab === "users") loadUsers();
  }, [activeTab]);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem("flyhost_token");
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setUsersList(d.users || []);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setUsersLoading(false);
  }

  async function handleBan(userId: number, banned: boolean) {
    const token = localStorage.getItem("flyhost_token");
    const res = await fetch(`/api/admin/users/${userId}/ban`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ banned }),
    });
    if (res.ok) {
      toast({ title: banned ? "Utilisateur banni" : "Utilisateur débanni" });
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, banned } : u));
    } else {
      const d = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: d.error });
    }
  }

  async function handleDeleteUser(userId: number, name: string) {
    if (!confirm(`Supprimer définitivement le compte de "${name}" ?`)) return;
    const token = localStorage.getItem("flyhost_token");
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast({ title: "Compte supprimé" });
      setUsersList(prev => prev.filter(u => u.id !== userId));
    } else {
      const d = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: d.error });
    }
  }

  async function handleCoins(userId: number, amount: number) {
    const token = localStorage.getItem("flyhost_token");
    const res = await fetch(`/api/admin/users/${userId}/coins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount }),
    });
    if (res.ok) {
      const d = await res.json();
      toast({ title: `Coins mis à jour → ${d.coins}` });
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, coins: d.coins } : u));
      setCoinsModal(null);
      setCoinsAmount("");
    } else {
      const d = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: d.error });
    }
  }

  async function handleRole(userId: number, role: string) {
    const token = localStorage.getItem("flyhost_token");
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      toast({ title: `Rôle changé → ${role}` });
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } else {
      const d = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: d.error });
    }
  }

  async function handlePowerAction(identifier: string, action: "start" | "stop" | "restart") {
    try {
      const res = await fetch(`/api/servers/${identifier}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const labels = { start: "démarré", stop: "arrêté", restart: "redémarré" };
        toast({ title: `Serveur ${labels[action]}` });
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur réseau", description: e.message });
    }
  }

  async function handleSuspend(serverId: number, suspend: boolean) {
    try {
      const res = await fetch(`/api/servers/${serverId}/${suspend ? "suspend" : "unsuspend"}`, { method: "POST" });
      if (res.ok) {
        toast({ title: suspend ? "Serveur suspendu" : "Serveur réactivé" });
        await loadPteroData();
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
  }

  async function handleDelete(serverId: number) {
    if (!confirm("Supprimer définitivement ce serveur ?")) return;
    try {
      const res = await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Serveur supprimé" });
        await loadPteroData();
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
  }

  const filteredServers = pteroServers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.identifier.toLowerCase().includes(search.toLowerCase())
  );

  const TABS = [
    { id: "overview", label: "Vue d'ensemble", icon: BarChart3 },
    { id: "users", label: "Utilisateurs", icon: Users, adminOnly: true },
    { id: "pterodactyl", label: "Pterodactyl", icon: Server, adminOnly: true },
    { id: "reseller", label: "Revendeur", icon: ShoppingBag },
    { id: "stats", label: "Statistiques", icon: Activity },
  ];

  const isAdmin = (user as any)?.role === "admin" || (user as any)?.role === "superadmin";

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-yellow-400" />
              {isAdmin ? "Panel Administrateur" : "Espace Revendeur"}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              {isAdmin
                ? "Gestion complète de la plateforme FlyHost"
                : "Gérez vos clients et revendez les services FlyHost"}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-yellow-400/20 bg-yellow-400/5">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-semibold text-sm">{coins} coins</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-x-auto">
          {TABS.filter(t => isAdmin || !t.adminOnly).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
                activeTab === tab.id
                  ? "bg-yellow-400 text-black"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Mes coins", value: coins, unit: "", icon: Coins, color: "text-yellow-400" },
                { label: "Serveurs actifs", value: pteroServers.filter(s => !s.suspended).length, unit: "", icon: Server, color: "text-emerald-400" },
                { label: "Clients", value: "0", unit: "", icon: Users, color: "text-blue-400" },
                { label: "Revenus", value: "0", unit: "coins", icon: BarChart3, color: "text-purple-400" },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-zinc-600 font-medium uppercase tracking-wide">{stat.label}</p>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}
                    {stat.unit && <span className="text-sm font-normal text-zinc-600 ml-1">{stat.unit}</span>}
                  </p>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" /> Actions rapides
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Créer un serveur", href: "/servers", icon: "🖥️" },
                  { label: "Déployer un projet", href: "/deploy", icon: "🚀" },
                  { label: "Voir les packs", action: () => setActiveTab("reseller"), icon: "💼" },
                  { label: "Panel Pterodactyl", href: "https://panel.lionelmelo.qzz.io", external: true, icon: "🦅" },
                  { label: "Statistiques", action: () => setActiveTab("stats"), icon: "📊" },
                  { label: "Mes projets", href: "/projects", icon: "📁" },
                ].map(item => (
                  item.href ? (
                    <a
                      key={item.label}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer" : undefined}
                      className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:border-yellow-400/30 hover:bg-yellow-400/3 transition-all text-sm text-zinc-400 hover:text-white"
                    >
                      <span>{item.icon}</span> {item.label}
                      {item.external && <ExternalLink className="w-3 h-3 ml-auto" />}
                    </a>
                  ) : (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:border-yellow-400/30 hover:bg-yellow-400/3 transition-all text-sm text-zinc-400 hover:text-white text-left"
                    >
                      <span>{item.icon}</span> {item.label}
                    </button>
                  )
                ))}
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-400/15 bg-yellow-400/3">
                <Shield className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-400">Mode Administrateur</p>
                  <p className="text-xs text-zinc-500">Vous avez accès à toutes les fonctionnalités de gestion de la plateforme.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Users Tab (admin only) ── */}
        {activeTab === "users" && isAdmin && (
          <div className="space-y-5">
            {/* Coins Modal */}
            {coinsModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
                  <h3 className="text-base font-bold text-white mb-1">Modifier les coins</h3>
                  <p className="text-sm text-zinc-400 mb-4">
                    <span className="text-white font-semibold">{coinsModal.name}</span> — actuellement{" "}
                    <span className="text-yellow-400 font-semibold">{coinsModal.coins}</span> coins
                  </p>
                  <Input
                    type="number"
                    placeholder="Ex: +500 ou -200"
                    value={coinsAmount}
                    onChange={e => setCoinsAmount(e.target.value)}
                    className="bg-zinc-800 border-zinc-600 focus:border-yellow-400/50 mb-4"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
                      onClick={() => {
                        const n = parseInt(coinsAmount);
                        if (isNaN(n) || n === 0) return toast({ variant: "destructive", title: "Montant invalide" });
                        handleCoins(coinsModal.userId, n);
                      }}
                    >
                      Confirmer
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-zinc-700 text-zinc-400"
                      onClick={() => { setCoinsModal(null); setCoinsAmount(""); }}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Input
                  placeholder="Rechercher un utilisateur…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 focus:border-yellow-400/50 max-w-sm"
                />
                <p className="text-sm text-zinc-600 flex-shrink-0">
                  {usersList.filter(u =>
                    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearch.toLowerCase())
                  ).length} utilisateur(s)
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={loadUsers} disabled={usersLoading} className="text-zinc-400 hover:text-white">
                <RefreshCw className={`w-4 h-4 ${usersLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Stats rapides */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total", value: usersList.length, color: "text-white", icon: Users },
                { label: "Bannis", value: usersList.filter(u => u.banned).length, color: "text-red-400", icon: Ban },
                { label: "Admins", value: usersList.filter(u => u.role === "admin" || u.role === "superadmin").length, color: "text-yellow-400", icon: Crown },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
                  <s.icon className={`w-5 h-5 mx-auto mb-2 ${s.color}`} />
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-zinc-600 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Users list */}
            {usersLoading ? (
              <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
              </div>
            ) : (
              <div className="space-y-2">
                {usersList
                  .filter(u =>
                    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.username.toLowerCase().includes(userSearch.toLowerCase())
                  )
                  .map(u => (
                    <div
                      key={u.id}
                      className={`rounded-xl border bg-zinc-900/40 p-4 transition-all ${u.banned ? "border-red-500/30 bg-red-500/3" : "border-zinc-800 hover:border-zinc-700"}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Avatar + info */}
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${u.banned ? "bg-red-500/20 text-red-400" : "bg-zinc-800 text-zinc-300"}`}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-white text-sm">{u.name}</p>
                              {u.banned && <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">Banni</Badge>}
                              {u.role === "admin" && <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20 text-xs">Admin</Badge>}
                              {u.role === "superadmin" && <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs">Super Admin</Badge>}
                              {!u.emailVerified && <Badge className="bg-zinc-700/50 text-zinc-500 border-zinc-600/20 text-xs">Non vérifié</Badge>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                              <span>{u.email}</span>
                              <span className="text-zinc-700">@{u.username}</span>
                            </div>
                          </div>
                        </div>

                        {/* Coins + actions */}
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                          {/* Coins */}
                          <button
                            onClick={() => setCoinsModal({ userId: u.id, name: u.name, coins: u.coins })}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-semibold hover:bg-yellow-400/20 transition-all"
                          >
                            <Coins className="w-3 h-3" />
                            {u.coins}
                          </button>

                          {/* Rôle toggle */}
                          {u.role !== "superadmin" && u.id !== (user as any)?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-7 px-2 text-xs gap-1 ${u.role === "admin" ? "text-yellow-400 hover:bg-yellow-400/10" : "text-zinc-500 hover:text-zinc-300"}`}
                              onClick={() => handleRole(u.id, u.role === "admin" ? "user" : "admin")}
                              title={u.role === "admin" ? "Rétrograder" : "Promouvoir admin"}
                            >
                              <Crown className="w-3 h-3" />
                              {u.role === "admin" ? "Admin" : "User"}
                            </Button>
                          )}

                          {/* Ban/Unban */}
                          {u.id !== (user as any)?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-7 px-2 text-xs gap-1 ${u.banned ? "text-emerald-400 hover:bg-emerald-500/10" : "text-orange-400 hover:bg-orange-500/10"}`}
                              onClick={() => handleBan(u.id, !u.banned)}
                            >
                              {u.banned ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                              {u.banned ? "Débannir" : "Bannir"}
                            </Button>
                          )}

                          {/* Delete */}
                          {u.id !== (user as any)?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              title="Supprimer le compte"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                {usersList.length === 0 && !usersLoading && (
                  <div className="py-10 text-center text-zinc-600">
                    <Users className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                    <p className="text-sm">Aucun utilisateur trouvé</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Pterodactyl Tab (admin only) ── */}
        {activeTab === "pterodactyl" && isAdmin && (
          <div className="space-y-5">
            {/* Connection status */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${pteroStatus?.connected ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              {pteroStatus?.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  {pteroStatus?.connected ? "Panel connecté" : "Panel non connecté"}
                </p>
                {pteroStatus && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {pteroStatus.panelUrl} — {pteroStatus.totalServers} serveurs — Node #{pteroStatus.nodeId}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://panel.lionelmelo.qzz.io"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
                >
                  Ouvrir <ExternalLink className="w-3 h-3" />
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadPteroData}
                  disabled={pteroLoading}
                  className="h-8 text-zinc-400 hover:text-white"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${pteroLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Server count stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total", value: pteroServers.length, icon: Server, color: "text-white" },
                { label: "Actifs", value: pteroServers.filter(s => !s.suspended && s.status !== "installing").length, icon: CheckCircle2, color: "text-emerald-400" },
                { label: "Suspendus", value: pteroServers.filter(s => s.suspended).length, icon: AlertCircle, color: "text-red-400" },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
                  <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-zinc-600 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Servers list */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Input
                  placeholder="Rechercher un serveur…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 focus:border-yellow-400/50 max-w-sm"
                />
                <p className="text-sm text-zinc-600">{filteredServers.length} serveur{filteredServers.length !== 1 ? "s" : ""}</p>
              </div>

              {pteroLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredServers.map(server => (
                    <div key={server.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <Server className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="font-semibold text-white text-sm">{server.name}</p>
                              <ServerStatus status={server.status} suspended={server.suspended} />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-600">
                              <span className="font-mono text-zinc-500">{server.identifier}</span>
                              {server.allocation && (
                                <span className="font-mono">{server.allocation.ip}:{server.allocation.port}</span>
                              )}
                              <span>{fmt(server.limits.memory)} RAM</span>
                              <span>{fmt(server.limits.disk)} Disk</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!server.suspended && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-400 hover:bg-emerald-500/10" title="Démarrer" onClick={() => handlePowerAction(server.identifier, "start")}>
                                <Play className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-400 hover:bg-orange-500/10" title="Arrêter" onClick={() => handlePowerAction(server.identifier, "stop")}>
                                <Square className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`h-7 px-2 text-xs ${server.suspended ? "text-emerald-400 hover:bg-emerald-500/10" : "text-yellow-400 hover:bg-yellow-400/10"}`}
                            onClick={() => handleSuspend(server.id, !server.suspended)}
                          >
                            {server.suspended ? "Réactiver" : "Suspendre"}
                          </Button>
                          <a href={`https://panel.lionelmelo.qzz.io/server/${server.identifier}`} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-500 hover:text-white">
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </a>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(server.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredServers.length === 0 && !pteroLoading && (
                    <div className="py-10 text-center text-zinc-600">
                      <Database className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                      <p className="text-sm">Aucun serveur trouvé</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Reseller Tab ── */}
        {activeTab === "reseller" && (
          <div className="space-y-6">
            {/* Hero */}
            <div className="rounded-2xl p-6 bg-gradient-to-br from-indigo-950 via-purple-950 to-violet-950 border border-purple-500/20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-purple-300 uppercase tracking-wider mb-1">Programme Revendeur</p>
                  <h2 className="text-2xl font-bold text-white">Revendez FlyHost</h2>
                  <p className="text-purple-300/70 text-sm mt-1">Marges de 10% à 20% sur tous les services</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-purple-200 text-xs font-bold">
                  <Coins className="w-3 h-3" /> {coins} coins
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["Clients actifs", "Revenus ce mois", "Taux de marge"].map((label, i) => (
                  <div key={label} className="rounded-xl p-3 bg-white/5 border border-white/10 backdrop-blur-sm">
                    <p className="text-xs text-purple-300/60 mb-1">{label}</p>
                    <p className="text-xl font-bold text-white">{i === 2 ? "—" : "0"}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Plans */}
            <div className="grid sm:grid-cols-3 gap-4">
              {RESELLER_PLANS.map(plan => (
                <div key={plan.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{plan.emoji}</span>
                    <div>
                      <p className="font-bold text-white text-sm">{plan.name}</p>
                      <p className="text-xs text-emerald-400 font-semibold">Marge {plan.margin}</p>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-yellow-400 mb-1">{plan.cost}
                    <span className="text-sm font-normal text-zinc-600 ml-1">coins</span>
                  </p>
                  <ul className="space-y-1.5 mb-4 mt-3">
                    {[`${plan.servers} crédits serveur`, `Marge ${plan.margin} sur renouvellements`, "Dashboard client inclus", "Support prioritaire"].map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-zinc-400">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-semibold text-sm"
                    onClick={() => {
                      if (coins < plan.cost) {
                        toast({ variant: "destructive", title: `Coins insuffisants — besoin de ${plan.cost}` });
                      } else {
                        toast({ title: "Bientôt disponible !", description: "Le programme revendeur sera lancé prochainement." });
                      }
                    }}
                  >
                    Acheter ce pack
                  </Button>
                </div>
              ))}
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { icon: "💰", title: "Marges attractives", desc: "10% à 20% selon le volume" },
                { icon: "🏷️", title: "White-label", desc: "Votre marque sur tous les services" },
                { icon: "📊", title: "Dashboard revendeur", desc: "Gestion centralisée clients" },
                { icon: "🎧", title: "Support prioritaire", desc: "Ligne dédiée 7j/7" },
                { icon: "📈", title: "Stats détaillées", desc: "Revenu, marge, activité" },
                { icon: "🔑", title: "API complète", desc: "Intégrez FlyHost dans vos outils" },
              ].map(f => (
                <div key={f.title} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-center">
                  <div className="text-2xl mb-2">{f.icon}</div>
                  <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
                  <p className="text-xs text-zinc-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats Tab ── */}
        {activeTab === "stats" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Revenus totaux", value: "0", unit: "coins", icon: "💰", color: "text-yellow-400" },
                { label: "Clients actifs", value: "0", icon: "👥", color: "text-blue-400" },
                { label: "Serveurs vendus", value: "0", icon: "🖥️", color: "text-purple-400" },
                { label: "Taux de rétention", value: "—", icon: "📈", color: "text-emerald-400" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-center">
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}
                    {s.unit && <span className="text-sm font-normal text-zinc-600 ml-1">{s.unit}</span>}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1 uppercase tracking-wide font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <BarChart3 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-600 text-sm">Les statistiques détaillées seront disponibles prochainement</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
