import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Server,
  Plus,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Zap,
  Terminal,
  Coins,
  Cpu,
  HardDrive,
  MemoryStick,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────
interface Plan {
  id: string;
  label: string;
  coins: number;
  limits: { memory: number; disk: number; cpu: number };
  category: string;
}

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

// ── Category icons & labels ────────────────────────────────────────
const CATEGORY_META: Record<string, { icon: string; label: string; color: string }> = {
  minecraft: { icon: "⛏️", label: "Minecraft",    color: "text-emerald-400" },
  gaming:    { icon: "🎮", label: "Jeux",         color: "text-purple-400"  },
  web:       { icon: "🌐", label: "Web / Dev",    color: "text-blue-400"    },
  voice:     { icon: "🎙️", label: "Vocal",        color: "text-pink-400"    },
  other:     { icon: "📦", label: "Autre",        color: "text-zinc-400"    },
};

// ── Status helpers ─────────────────────────────────────────────────
function ServerStatus({ status, suspended }: { status: string | null; suspended: boolean }) {
  if (suspended)
    return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Suspendu</Badge>;
  if (!status || status === "installing")
    return <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20 animate-pulse">Installation…</Badge>;
  return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Actif</Badge>;
}

function fmt(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} Go` : `${mb} Mo`;
}

// ── Plan card ─────────────────────────────────────────────────────
function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = CATEGORY_META[plan.category] || CATEGORY_META.other;
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
        selected
          ? "border-yellow-400/60 bg-yellow-400/8 shadow-[0_0_15px_rgba(250,204,21,0.08)]"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{meta.icon}</span>
          <div>
            <p className="font-semibold text-white text-sm leading-tight">{plan.label}</p>
            <p className={`text-xs ${meta.color}`}>{meta.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-yellow-400 text-sm font-bold flex-shrink-0">
          <Coins className="w-3.5 h-3.5" />
          {plan.coins}
          <span className="text-yellow-400/50 font-normal text-xs">/mois</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-600">
        <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" />{fmt(plan.limits.memory)}</span>
        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{fmt(plan.limits.disk)}</span>
        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{plan.limits.cpu}%</span>
      </div>
      {selected && (
        <div className="mt-2 flex items-center gap-1 text-xs text-yellow-400">
          <CheckCircle2 className="w-3 h-3" /> Sélectionné
        </div>
      )}
    </button>
  );
}

// ── Server row ────────────────────────────────────────────────────
function ServerRow({
  server,
  onAction,
  onDelete,
}: {
  server: PteroServer;
  onAction: (id: string, action: "start" | "stop" | "restart") => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Server className="w-5 h-5 text-zinc-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-white text-sm">{server.name}</p>
              <ServerStatus status={server.status} suspended={server.suspended} />
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              {server.allocation && (
                <span className="font-mono">{server.allocation.ip}:{server.allocation.port}</span>
              )}
              <span className="flex items-center gap-1">
                <MemoryStick className="w-3 h-3" />{fmt(server.limits.memory)}
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3" />{fmt(server.limits.disk)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {!server.suspended && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-emerald-400 hover:bg-emerald-500/10"
                title="Démarrer"
                onClick={() => onAction(server.identifier, "start")}
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-yellow-400 hover:bg-yellow-400/10"
                title="Redémarrer"
                onClick={() => onAction(server.identifier, "restart")}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-orange-400 hover:bg-orange-500/10"
                title="Arrêter"
                onClick={() => onAction(server.identifier, "stop")}
              >
                <Square className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <a
            href={`https://panel.lionelmelo.qzz.io/server/${server.identifier}`}
            target="_blank"
            rel="noreferrer"
          >
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white" title="Ouvrir dans le panel">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </a>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10"
            title="Supprimer"
            onClick={() => onDelete(server.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function ServersPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [servers, setServers] = useState<PteroServer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [serverName, setServerName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const coins = (user as any)?.coins ?? 0;

  // Load servers & plans
  async function load() {
    setLoading(true);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/servers"),
        fetch("/api/servers/plans"),
      ]);
      if (sRes.ok) {
        const d = await sRes.json();
        setServers(d.servers || []);
      }
      if (pRes.ok) {
        const d = await pRes.json();
        setPlans(d.plans || []);
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createServer() {
    if (!serverName.trim() || !selectedPlan) {
      toast({ variant: "destructive", title: "Remplissez tous les champs" });
      return;
    }
    const plan = plans.find(p => p.id === selectedPlan)!;
    if (coins < plan.coins) {
      toast({
        variant: "destructive",
        title: "Coins insuffisants",
        description: `Ce serveur coûte ${plan.coins} coins. Vous en avez ${coins}.`,
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: serverName, gameType: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: data.error });
      } else {
        toast({
          title: "Serveur créé ! 🎉",
          description: `${data.coinsDeducted} coins déduits — ${data.coinsRemaining} restants.`,
        });
        setShowCreate(false);
        setServerName("");
        setSelectedPlan(null);
        await load();
        await refreshUser();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur réseau", description: e.message });
    }
    setCreating(false);
  }

  async function handlePowerAction(identifier: string, action: "start" | "stop" | "restart") {
    try {
      const res = await fetch(`/api/servers/${identifier}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        const labels = { start: "démarré", stop: "arrêté", restart: "redémarré" };
        toast({ title: `Serveur ${labels[action]}` });
      } else {
        toast({ variant: "destructive", title: "Erreur", description: data.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur réseau", description: e.message });
    }
  }

  async function handleDelete(serverId: number) {
    if (!confirm("Supprimer définitivement ce serveur ? Cette action est irréversible.")) return;
    try {
      const res = await fetch(`/api/servers/${serverId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Serveur supprimé" });
        await load();
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur réseau", description: e.message });
    }
  }

  const categories = ["all", ...Array.from(new Set(plans.map(p => p.category)))];
  const filteredPlans = categoryFilter === "all" ? plans : plans.filter(p => p.category === categoryFilter);
  const selectedPlanInfo = plans.find(p => p.id === selectedPlan);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Server className="w-6 h-6 text-yellow-400" />
              Mes Serveurs
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Gérez vos serveurs hébergés sur Pterodactyl
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold gap-2"
          >
            <Plus className="w-4 h-4" /> Nouveau serveur
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Serveurs", value: servers.length, icon: Server, color: "text-white" },
            { label: "Actifs", value: servers.filter(s => !s.suspended && s.status !== "installing").length, icon: CheckCircle2, color: "text-emerald-400" },
            { label: "Installation", value: servers.filter(s => s.status === "installing").length, icon: Clock, color: "text-yellow-400" },
            { label: "Suspendus", value: servers.filter(s => s.suspended).length, icon: AlertCircle, color: "text-red-400" },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-zinc-600 font-medium uppercase tracking-wide">{stat.label}</p>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Panel link */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-400/15 bg-yellow-400/3">
          <Info className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-zinc-400 flex-1">
            Panel Pterodactyl connecté à <span className="text-yellow-400 font-mono text-xs">panel.lionelmelo.qzz.io</span>
          </p>
          <a
            href="https://panel.lionelmelo.qzz.io"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 font-medium"
          >
            Ouvrir le panel <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Servers list */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            {loading ? "Chargement…" : `${servers.length} serveur${servers.length !== 1 ? "s" : ""}`}
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 rounded-xl border border-zinc-800 bg-zinc-900/50 animate-pulse" />
              ))}
            </div>
          ) : servers.length > 0 ? (
            <div className="space-y-3">
              {servers.map(s => (
                <ServerRow
                  key={s.id}
                  server={s}
                  onAction={handlePowerAction}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Server className="w-7 h-7 text-zinc-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Aucun serveur</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Créez votre premier serveur en quelques clics.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
              >
                <Plus className="w-4 h-4 mr-2" /> Créer un serveur
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Server Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" /> Nouveau serveur
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Choisissez un type de serveur et donnez-lui un nom.
              Le serveur sera créé instantanément sur Pterodactyl.
            </DialogDescription>
          </DialogHeader>

          {/* Coins indicator */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/15">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-semibold">{coins} coins disponibles</span>
            {selectedPlanInfo && (
              <span className="text-zinc-500 text-xs ml-auto">
                Ce serveur coûte <strong className="text-yellow-400">{selectedPlanInfo.coins}</strong> coins
                → reste <strong className={coins - selectedPlanInfo.coins >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {coins - selectedPlanInfo.coins}
                </strong>
              </span>
            )}
          </div>

          {/* Server name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Nom du serveur</label>
            <Input
              placeholder="mon-serveur-minecraft"
              value={serverName}
              onChange={e => setServerName(e.target.value)}
              className="bg-zinc-900 border-zinc-700 focus:border-yellow-400/50"
            />
          </div>

          {/* Category tabs */}
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-3 block">Type de serveur</label>
            <div className="flex gap-2 flex-wrap mb-4">
              {categories.map(cat => {
                const meta = cat === "all" ? { icon: "🌟", label: "Tous" } : CATEGORY_META[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      categoryFilter === cat
                        ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    }`}
                  >
                    <span>{meta?.icon}</span>
                    {meta?.label || cat}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
              {filteredPlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  selected={selectedPlan === plan.id}
                  onSelect={() => setSelectedPlan(plan.id)}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <Button
              variant="ghost"
              onClick={() => setShowCreate(false)}
              className="text-zinc-400 hover:text-white"
            >
              Annuler
            </Button>
            <Button
              onClick={createServer}
              disabled={creating || !serverName.trim() || !selectedPlan}
              className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold gap-2"
            >
              {creating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Création en cours…</>
              ) : (
                <><Zap className="w-4 h-4" /> Créer le serveur</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
