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
import { Link } from "wouter";
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
  Info,
  Search,
} from "lucide-react";

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

// ── Tech-specific icons & colors per plan type ─────────────────────
const PLAN_META: Record<string, {
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  bg: string;
  label: string;
  desc: string;
  category: string;
}> = {
  "nodejs": {
    icon: <NodeJsIcon />,
    color: "text-[#68a063]",
    borderColor: "rgba(104,160,99,0.4)",
    bg: "rgba(104,160,99,0.1)",
    label: "Node.js",
    desc: "Apps JS/TS, Discord bots, APIs",
    category: "web",
  },
  "python": {
    icon: <PythonIcon />,
    color: "text-[#ffd845]",
    borderColor: "rgba(55,118,171,0.4)",
    bg: "rgba(55,118,171,0.1)",
    label: "Python",
    desc: "Scripts, Flask, Django, bots",
    category: "web",
  },
  "php": {
    icon: <PhpIcon />,
    color: "text-[#9b59d0]",
    borderColor: "rgba(155,89,208,0.4)",
    bg: "rgba(155,89,208,0.1)",
    label: "PHP",
    desc: "Sites web, CMS, APIs PHP",
    category: "web",
  },
  "java": {
    icon: <JavaIcon />,
    color: "text-[#f89820]",
    borderColor: "rgba(248,152,32,0.4)",
    bg: "rgba(248,152,32,0.1)",
    label: "Java",
    desc: "Apps JVM génériques",
    category: "web",
  },
  "vanilla-mc": {
    icon: <McIcon char="V" color="#4e9a43" />,
    color: "text-emerald-400",
    borderColor: "rgba(74,154,67,0.4)",
    bg: "rgba(74,154,67,0.1)",
    label: "Minecraft Vanilla",
    desc: "Serveur officiel Mojang",
    category: "minecraft",
  },
  "paper-mc": {
    icon: <McIcon char="P" color="#77b255" />,
    color: "text-green-400",
    borderColor: "rgba(119,178,85,0.4)",
    bg: "rgba(119,178,85,0.1)",
    label: "Paper MC",
    desc: "Haute perf, plugins Bukkit/Spigot",
    category: "minecraft",
  },
  "forge-mc": {
    icon: <McIcon char="F" color="#e17d1b" />,
    color: "text-orange-400",
    borderColor: "rgba(225,125,27,0.4)",
    bg: "rgba(225,125,27,0.1)",
    label: "Minecraft Forge",
    desc: "Mods Forge & modpacks",
    category: "minecraft",
  },
  "csgo": {
    icon: <GameIcon emoji="🎯" />,
    color: "text-yellow-400",
    borderColor: "rgba(245,166,35,0.4)",
    bg: "rgba(245,166,35,0.1)",
    label: "CS:GO",
    desc: "Counter-Strike: Global Offensive",
    category: "gaming",
  },
  "gmod": {
    icon: <GameIcon emoji="🔧" />,
    color: "text-cyan-400",
    borderColor: "rgba(79,152,168,0.4)",
    bg: "rgba(79,152,168,0.1)",
    label: "Garry's Mod",
    desc: "Sandbox, DarkRP, TTT…",
    category: "gaming",
  },
  "rust": {
    icon: <GameIcon emoji="🦀" />,
    color: "text-red-400",
    borderColor: "rgba(206,66,43,0.4)",
    bg: "rgba(206,66,43,0.1)",
    label: "Rust",
    desc: "Serveur de survie Rust",
    category: "gaming",
  },
  "teamspeak": {
    icon: <TsIcon />,
    color: "text-blue-400",
    borderColor: "rgba(31,117,254,0.4)",
    bg: "rgba(31,117,254,0.1)",
    label: "TeamSpeak 3",
    desc: "Serveur vocal communautaire",
    category: "voice",
  },
};

// ── Inline SVG / icon components ──────────────────────────────────
function NodeJsIcon() {
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="#68a063" opacity="0.2" />
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke="#68a063" strokeWidth="1.5" />
      <text x="16" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#68a063">N</text>
    </svg>
  );
}
function PythonIcon() {
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
      <rect x="4" y="4" width="24" height="24" rx="6" fill="#3776ab" opacity="0.2" />
      <rect x="4" y="4" width="24" height="24" rx="6" stroke="#3776ab" strokeWidth="1.5" />
      <text x="16" y="22" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#ffd845">🐍</text>
    </svg>
  );
}
function PhpIcon() {
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
      <ellipse cx="16" cy="16" rx="13" ry="9" fill="#9b59d0" opacity="0.2" />
      <ellipse cx="16" cy="16" rx="13" ry="9" stroke="#9b59d0" strokeWidth="1.5" />
      <text x="16" y="20.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#9b59d0">PHP</text>
    </svg>
  );
}
function JavaIcon() {
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
      <circle cx="16" cy="16" r="12" fill="#f89820" opacity="0.15" />
      <circle cx="16" cy="16" r="12" stroke="#f89820" strokeWidth="1.5" />
      <text x="16" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#f89820">☕</text>
    </svg>
  );
}
function McIcon({ char, color }: { char: string; color: string }) {
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
      <rect x="4" y="4" width="24" height="24" rx="4" fill={color} opacity="0.2" />
      <rect x="4" y="4" width="24" height="24" rx="4" stroke={color} strokeWidth="1.5" />
      <text x="16" y="22" textAnchor="middle" fontSize="13" fontWeight="bold" fill={color}>{char}</text>
    </svg>
  );
}
function GameIcon({ emoji }: { emoji: string }) {
  return (
    <div className="w-8 h-8 flex items-center justify-center text-xl">{emoji}</div>
  );
}
function TsIcon() {
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
      <path d="M4 8 Q16 4 28 8 L28 18 Q16 28 4 18 Z" fill="#1f75fe" opacity="0.2" />
      <path d="M4 8 Q16 4 28 8 L28 18 Q16 28 4 18 Z" stroke="#1f75fe" strokeWidth="1.5" />
      <text x="16" y="19" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1f75fe">TS3</text>
    </svg>
  );
}

// ── Category filters ───────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",       label: "Tous",        emoji: "✦" },
  { id: "web",       label: "Web / Dev",   emoji: "🌐" },
  { id: "minecraft", label: "Minecraft",   emoji: "⛏️" },
  { id: "gaming",    label: "Jeux",        emoji: "🎮" },
  { id: "voice",     label: "Vocal",       emoji: "🎙️" },
];

// ── Status badge ───────────────────────────────────────────────────
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

// Detect tech from server name for the server row icon
function getServerTypeFromName(name: string): string | null {
  const low = name.toLowerCase();
  if (low.includes("paper")) return "paper-mc";
  if (low.includes("forge")) return "forge-mc";
  if (low.includes("vanilla") || low.includes("minecraft") || low.includes("-mc")) return "vanilla-mc";
  if (low.includes("node") || low.includes("nodejs")) return "nodejs";
  if (low.includes("python") || low.includes("py")) return "python";
  if (low.includes("php")) return "php";
  if (low.includes("java")) return "java";
  if (low.includes("csgo") || low.includes("cs:go")) return "csgo";
  if (low.includes("gmod") || low.includes("garry")) return "gmod";
  if (low.includes("rust")) return "rust";
  if (low.includes("teamspeak") || low.includes("ts3")) return "teamspeak";
  return null;
}

// ── Plan Card ─────────────────────────────────────────────────────
function PlanCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const meta = PLAN_META[plan.id];
  if (!meta) return null;
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 relative overflow-hidden group ${
        selected
          ? "shadow-lg"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
      style={selected ? {
        borderColor: meta.borderColor,
        background: meta.bg,
        boxShadow: `0 0 20px ${meta.borderColor}`,
      } : {}}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: meta.bg, border: `1px solid ${meta.borderColor}` }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <p className="font-semibold text-white text-sm leading-tight truncate">{meta.label}</p>
            <div className="flex items-center gap-0.5 text-yellow-400 text-xs font-bold flex-shrink-0">
              <Coins className="w-3 h-3" />
              {plan.coins}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">{meta.desc}</p>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-600">
            <span className="flex items-center gap-0.5"><MemoryStick className="w-2.5 h-2.5" />{fmt(plan.limits.memory)}</span>
            <span className="flex items-center gap-0.5"><HardDrive className="w-2.5 h-2.5" />{fmt(plan.limits.disk)}</span>
            <span className="flex items-center gap-0.5"><Cpu className="w-2.5 h-2.5" />{plan.limits.cpu}%</span>
          </div>
        </div>
      </div>
      {selected && (
        <div className="absolute top-2 right-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400" />
        </div>
      )}
    </button>
  );
}

// ── Server Row ────────────────────────────────────────────────────
function ServerRow({
  server,
  onAction,
  onDelete,
}: {
  server: PteroServer;
  onAction: (id: string, action: "start" | "stop" | "restart") => void;
  onDelete: (id: number) => void;
}) {
  const type = getServerTypeFromName(server.name);
  const meta = type ? PLAN_META[type] : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={meta ? { background: meta.bg, border: `1px solid ${meta.borderColor}` } : {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {meta ? meta.icon : <Server className="w-5 h-5 text-zinc-500" />}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-semibold text-white text-sm">{server.name.replace(/\s*\[FH-\d+\]$/, "")}</p>
              <ServerStatus status={server.status} suspended={server.suspended} />
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              {server.allocation && (
                <span className="font-mono">{server.allocation.ip}:{server.allocation.port}</span>
              )}
              <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" />{fmt(server.limits.memory)}</span>
              <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{fmt(server.limits.disk)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link href={`/servers/${server.identifier}`}>
            <Button size="sm" className="h-8 gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-yellow-400/30 hover:text-yellow-400 font-medium">
              <Terminal className="w-3.5 h-3.5" /> Gérer
            </Button>
          </Link>
          {!server.suspended && (
            <>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-400 hover:bg-emerald-500/10" title="Démarrer" onClick={() => onAction(server.identifier, "start")}>
                <Play className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-yellow-400 hover:bg-yellow-400/10" title="Redémarrer" onClick={() => onAction(server.identifier, "restart")}>
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-orange-400 hover:bg-orange-500/10" title="Arrêter" onClick={() => onAction(server.identifier, "stop")}>
                <Square className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:bg-red-500/10" title="Supprimer" onClick={() => onDelete(server.id)}>
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
  const [createStep, setCreateStep] = useState<string>("");

  const [serverName, setServerName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Free trial
  const [trialStatus, setTrialStatus] = useState<{ freeTrialUsed: boolean; trialActive: boolean; trialExpiresAt: string | null } | null>(null);
  const [showTrialCreate, setShowTrialCreate] = useState(false);
  const [trialName, setTrialName] = useState("");
  const [creatingTrial, setCreatingTrial] = useState(false);

  const coins = (user as any)?.coins ?? 0;

  async function load() {
    setLoading(true);
    try {
      const [sRes, pRes, tRes] = await Promise.all([
        fetch("/api/servers"),
        fetch("/api/servers/plans"),
        fetch("/api/servers/free-trial/status"),
      ]);
      if (sRes.ok) {
        const d = await sRes.json();
        setServers(d.servers || []);
      } else {
        const d = await sRes.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Erreur chargement", description: d.error || "Impossible de charger les serveurs" });
      }
      if (pRes.ok) {
        const d = await pRes.json();
        setPlans(d.plans || []);
      }
      if (tRes.ok) {
        setTrialStatus(await tRes.json());
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur réseau", description: e.message });
    }
    setLoading(false);
  }

  async function createTrialServer() {
    const cleaned = trialName.trim().replace(/[^a-zA-Z0-9\-_ ]/g, "") || `essai-${(user as any)?.username || "user"}`;
    setCreatingTrial(true);
    try {
      const res = await fetch("/api/servers/free-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: data.error });
      } else {
        toast({ title: "Serveur d'essai créé ! 🎉", description: "Il sera supprimé automatiquement dans 24H." });
        setShowTrialCreate(false);
        setTrialName("");
        await load();
        await refreshUser();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur réseau", description: e.message });
    }
    setCreatingTrial(false);
  }

  function formatCountdown(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expiré";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m restantes`;
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

    // Validate server name
    const cleaned = serverName.trim().replace(/[^a-zA-Z0-9\-_ ]/g, "");
    if (!cleaned) {
      toast({ variant: "destructive", title: "Nom invalide", description: "Utilisez uniquement des lettres, chiffres, tirets et espaces." });
      return;
    }

    setCreating(true);
    setCreateStep("Vérification des allocations…");
    try {
      setCreateStep("Création du compte Pterodactyl…");
      await new Promise(r => setTimeout(r, 300));
      setCreateStep("Déploiement du serveur sur le nœud…");

      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleaned, gameType: selectedPlan }),
      });
      const data = await res.json();

      if (!res.ok) {
        let errMsg = data.error || "Erreur inconnue";
        if (errMsg.includes("allocation")) errMsg = "Aucun port disponible sur le nœud. Contactez l'administrateur.";
        if (errMsg.includes("egg")) errMsg = "Type de serveur non configuré sur le panel. Vérifiez les eggs installés.";
        toast({ variant: "destructive", title: "Création échouée", description: errMsg });
      } else {
        toast({
          title: "Serveur créé ! 🎉",
          description: `${data.coinsDeducted} coins déduits — ${data.coinsRemaining} restants.`,
        });
        setShowCreate(false);
        setServerName("");
        setSelectedPlan(null);
        setCategoryFilter("all");
        await load();
        await refreshUser();
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur réseau", description: e.message });
    }
    setCreating(false);
    setCreateStep("");
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

  const selectedPlanInfo = plans.find(p => p.id === selectedPlan);

  const filteredPlans = plans.filter(p => {
    const meta = PLAN_META[p.id];
    if (!meta) return false;
    if (categoryFilter !== "all" && meta.category !== categoryFilter) return false;
    if (searchFilter && !meta.label.toLowerCase().includes(searchFilter.toLowerCase()) && !meta.desc.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

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
            <p className="text-zinc-500 text-sm mt-1">Gérez vos serveurs hébergés sur Pterodactyl</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold gap-2">
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

        {/* ── Free Trial Banner ── */}
        {trialStatus && !trialStatus.freeTrialUsed && (
          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 via-zinc-900/80 to-zinc-900/60 p-5">
            {showTrialCreate ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🚀</span>
                  <p className="font-bold text-white text-sm">Nommez votre serveur d'essai</p>
                </div>
                <input
                  value={trialName}
                  onChange={e => setTrialName(e.target.value)}
                  placeholder={`essai-${(user as any)?.username || "server"}`}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-400/50 focus:outline-none"
                  onKeyDown={e => e.key === "Enter" && createTrialServer()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-emerald-500 text-white hover:bg-emerald-400 font-semibold text-sm gap-2"
                    onClick={createTrialServer}
                    disabled={creatingTrial}
                  >
                    {creatingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer mon serveur gratuit"}
                  </Button>
                  <Button variant="ghost" className="text-zinc-500" onClick={() => setShowTrialCreate(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 text-lg">
                    🎁
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-white text-sm">Serveur d'essai gratuit — 24H</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">GRATUIT</span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Testez FlyHost avec un serveur Node.js gratuit. Valeur : <span className="text-yellow-400 font-semibold">50 coins</span>. Supprimé automatiquement après 24H.
                    </p>
                  </div>
                </div>
                <Button
                  className="bg-emerald-500 text-white hover:bg-emerald-400 font-semibold text-sm gap-2 flex-shrink-0"
                  onClick={() => setShowTrialCreate(true)}
                >
                  <Zap className="w-4 h-4" /> Activer l'essai
                </Button>
              </div>
            )}
          </div>
        )}

        {trialStatus?.trialActive && trialStatus.trialExpiresAt && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Serveur d'essai actif</p>
              <p className="text-xs text-zinc-400">{formatCountdown(trialStatus.trialExpiresAt)} — suppression automatique à l'expiration</p>
            </div>
          </div>
        )}

        {/* Panel link */}
        <div className="flex items-center gap-3 p-4 rounded-xl border border-yellow-400/15 bg-yellow-400/3">
          <Info className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-zinc-400 flex-1">
            Panel Pterodactyl connecté à{" "}
            <span className="text-yellow-400 font-mono text-xs">panel.lionelmelo.qzz.io</span>
          </p>
          <a href="https://panel.lionelmelo.qzz.io" target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 font-medium">
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
                <ServerRow key={s.id} server={s} onAction={handlePowerAction} onDelete={handleDelete} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Server className="w-7 h-7 text-zinc-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Aucun serveur</h3>
              <p className="text-zinc-500 text-sm mb-6">Créez votre premier serveur en quelques clics.</p>
              <Button onClick={() => setShowCreate(true)} className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold">
                <Plus className="w-4 h-4 mr-2" /> Créer un serveur
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Server Dialog ── */}
      <Dialog open={showCreate} onOpenChange={v => { if (!creating) setShowCreate(v); }}>
        <DialogContent className="bg-zinc-950 border-zinc-800 max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" /> Nouveau serveur
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Sélectionnez un type, donnez un nom — le serveur est créé instantanément sur Pterodactyl.
            </DialogDescription>
          </DialogHeader>

          {/* Coins indicator */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/15">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-yellow-400 font-semibold">{coins} coins disponibles</span>
            {selectedPlanInfo && (
              <span className="text-zinc-500 text-xs ml-auto">
                Coût : <strong className="text-yellow-400">{selectedPlanInfo.coins}</strong> coins
                {" → "}
                <strong className={coins - selectedPlanInfo.coins >= 0 ? "text-emerald-400" : "text-red-400"}>
                  {coins - selectedPlanInfo.coins} restants
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
              disabled={creating}
            />
            <p className="text-xs text-zinc-600">Lettres, chiffres, tirets et espaces uniquement.</p>
          </div>

          {/* Category filter + search */}
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-3 block">Type de serveur</label>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      categoryFilter === cat.id
                        ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-400"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    }`}
                  >
                    <span>{cat.emoji}</span>{cat.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                <Input
                  placeholder="Rechercher…"
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="pl-9 h-8 text-xs bg-zinc-900 border-zinc-800 focus:border-zinc-700"
                />
              </div>
            </div>

            {filteredPlans.length === 0 ? (
              <div className="py-8 text-center text-zinc-600 text-sm border border-dashed border-zinc-800 rounded-xl">
                Aucun type trouvé
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {filteredPlans.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    selected={selectedPlan === plan.id}
                    onSelect={() => setSelectedPlan(plan.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Selected plan summary */}
          {selectedPlanInfo && PLAN_META[selectedPlanInfo.id] && (
            <div
              className="p-3 rounded-xl border flex items-center gap-3"
              style={{
                borderColor: PLAN_META[selectedPlanInfo.id].borderColor,
                background: PLAN_META[selectedPlanInfo.id].bg,
              }}
            >
              <div className="flex-shrink-0">{PLAN_META[selectedPlanInfo.id].icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{PLAN_META[selectedPlanInfo.id].label}</p>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                  <span><MemoryStick className="w-3 h-3 inline mr-0.5" />{fmt(selectedPlanInfo.limits.memory)}</span>
                  <span><HardDrive className="w-3 h-3 inline mr-0.5" />{fmt(selectedPlanInfo.limits.disk)}</span>
                  <span><Cpu className="w-3 h-3 inline mr-0.5" />{selectedPlanInfo.limits.cpu}%</span>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            </div>
          )}

          {/* Creating progress */}
          {creating && createStep && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
              <Loader2 className="w-4 h-4 animate-spin text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-zinc-400">{createStep}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-zinc-400 hover:text-white" disabled={creating}>
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
