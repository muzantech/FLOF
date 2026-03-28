import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useGetStats, useListProjects } from "@workspace/api-client-react";
import { ProjectStatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Activity,
  Globe,
  Box,
  CheckCircle2,
  Github,
  ExternalLink,
  Rocket,
  Coins,
  CreditCard,
  Gift,
  ArrowRight,
  TrendingUp,
  Zap,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
  accent,
  href,
}: {
  title: string;
  value: string | number;
  icon: any;
  loading: boolean;
  accent?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`rounded-xl border p-5 flex flex-col justify-between h-[120px] transition-all duration-200 ${
        accent
          ? "border-yellow-400/25 bg-yellow-400/5 hover:border-yellow-400/40"
          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-medium uppercase tracking-wide ${accent ? "text-yellow-400/70" : "text-zinc-500"}`}>
          {title}
        </h3>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent ? "bg-yellow-400/15" : "bg-zinc-800"}`}>
          <Icon className={`w-3.5 h-3.5 ${accent ? "text-yellow-400" : "text-zinc-400"}`} />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24 bg-zinc-800" />
      ) : (
        <div className={`text-2xl font-bold ${accent ? "text-yellow-400" : "text-white"}`}>{value}</div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col h-[180px]">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-full bg-zinc-800" />
          <div>
            <Skeleton className="h-4 w-28 bg-zinc-800 mb-2" />
            <Skeleton className="h-3 w-20 bg-zinc-800" />
          </div>
        </div>
      </div>
      <div className="mt-auto pt-4 border-t border-zinc-800">
        <Skeleton className="h-3 w-40 bg-zinc-800" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: stats, isLoading: isStatsLoading } = useGetStats();
  const { data: projects, isLoading: isProjectsLoading } = useListProjects();

  const recentProjects = projects?.slice(0, 3) || [];
  const coins = (user as any)?.coins ?? 0;
  const planLabel = coins >= 4000 ? "Enterprise" : coins >= 1500 ? "Pro" : coins >= 500 ? "Starter" : "Free";

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Bonjour, {user?.name?.split(" ")[0]} 👋
            </h1>
            <p className="text-zinc-500 text-sm mt-1">Bienvenue sur votre tableau de bord FlyHost</p>
          </div>
          <Link href="/deploy">
            <Button className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold gap-2 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
              <Rocket className="w-4 h-4" /> Déployer
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Coins"
            value={coins.toLocaleString("fr-FR")}
            icon={Coins}
            loading={false}
            accent
            href="/subscription"
          />
          <StatCard
            title="Projets"
            value={stats?.totalProjects ?? 0}
            icon={Box}
            loading={isStatsLoading}
          />
          <StatCard
            title="Déploiements actifs"
            value={stats?.activeDeployments ?? 0}
            icon={Activity}
            loading={isStatsLoading}
          />
          <StatCard
            title="Taux de succès"
            value={`${stats?.successRate ?? 100}%`}
            icon={TrendingUp}
            loading={isStatsLoading}
          />
        </div>

        {/* Quick Actions + Plan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Plan Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium mb-1">Abonnement actuel</p>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-white">{planLabel}</span>
                  {planLabel !== "Free" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 border border-yellow-400/20 font-medium">
                      Actif
                    </span>
                  )}
                </div>
              </div>
              <CreditCard className="w-6 h-6 text-zinc-600" />
            </div>
            <div className="flex items-center gap-1.5 text-sm text-yellow-400">
              <Coins className="w-4 h-4" />
              <span className="font-semibold">{coins} coins</span>
              <span className="text-zinc-600">disponibles</span>
            </div>
            <Link href="/subscription">
              <Button size="sm" variant="outline" className="w-full border-zinc-700 hover:border-yellow-400/40 hover:text-yellow-400 text-xs gap-1.5">
                Gérer l'abonnement <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>

          {/* Quick Deploy */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-zinc-400" />
              <p className="font-semibold text-white">Déploiement rapide</p>
            </div>
            <p className="text-sm text-zinc-500">Déployez depuis GitHub, un fichier ZIP ou un template en quelques clics.</p>
            <Link href="/deploy">
              <Button size="sm" className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs gap-1.5">
                <Zap className="w-3 h-3" /> Nouveau déploiement
              </Button>
            </Link>
          </div>

          {/* Referral */}
          <div className="rounded-xl border border-yellow-400/15 bg-yellow-400/3 p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-yellow-400" />
              <p className="font-semibold text-white">Parrainage</p>
            </div>
            <p className="text-sm text-zinc-500">
              Invitez des amis et gagnez <span className="text-yellow-400 font-medium">+50 coins</span> par inscription validée.
            </p>
            <Link href="/referral">
              <Button size="sm" variant="outline" className="w-full border-yellow-400/20 hover:border-yellow-400/40 text-yellow-400 hover:text-yellow-300 text-xs gap-1.5">
                <Gift className="w-3 h-3" /> Voir mon lien de parrainage
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-white">Projets récents</h2>
            <Link href="/projects">
              <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white text-xs gap-1">
                Voir tout <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isProjectsLoading ? (
              <>
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
              </>
            ) : recentProjects.length > 0 ? (
              recentProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="group">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 h-full flex flex-col hover:border-zinc-700 transition-all duration-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 text-sm font-bold text-white">
                          {project.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-white leading-none mb-1 group-hover:text-yellow-400 transition-colors">
                            {project.name}
                          </h3>
                          <p className="text-xs text-zinc-500">{project.slug}.flyhost.app</p>
                        </div>
                      </div>
                      <ProjectStatusBadge status={project.status} />
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                      {project.gitRepo && (
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <Github className="w-3 h-3" />
                          <span className="truncate max-w-[140px]">{project.gitRepo}</span>
                        </div>
                      )}
                      {project.framework && (
                        <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {project.framework}
                        </span>
                      )}
                    </div>

                    <div className="mt-auto pt-3 border-t border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            project.latestDeploymentStatus === "ready"
                              ? "bg-emerald-500"
                              : project.latestDeploymentStatus === "building"
                              ? "bg-yellow-400 animate-pulse"
                              : project.latestDeploymentStatus === "error"
                              ? "bg-red-500"
                              : "bg-zinc-600"
                          }`}
                        />
                        {project.latestDeploymentStatus
                          ? project.latestDeploymentStatus === "ready"
                            ? "En ligne"
                            : project.latestDeploymentStatus === "building"
                            ? "Build en cours"
                            : project.latestDeploymentStatus === "error"
                            ? "Erreur"
                            : project.latestDeploymentStatus
                          : "Aucun déploiement"}
                        <span>·</span>
                        <span>
                          {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                      {project.latestDeploymentUrl && (
                        <a
                          href={project.latestDeploymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-zinc-600 hover:text-white p-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-16 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
                <Box className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
                <h3 className="text-base font-semibold text-white mb-2">Aucun projet</h3>
                <p className="text-zinc-500 text-sm mb-6">Créez votre premier projet pour commencer à déployer.</p>
                <Link href="/deploy">
                  <Button className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold">
                    <Rocket className="w-4 h-4 mr-2" /> Déployer maintenant
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {[
            { href: "/docs", icon: Globe, label: "Documentation", desc: "Guides et référence API" },
            { href: "/status", icon: CheckCircle2, label: "Statut de la plateforme", desc: "Tous les systèmes opérationnels" },
            { href: "/history", icon: Activity, label: "Historique", desc: "Vos transactions et activités" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60 transition-all group cursor-pointer">
                <item.icon className="w-4 h-4 text-zinc-600 group-hover:text-yellow-400 transition-colors flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-yellow-400 transition-colors leading-none mb-0.5">
                    {item.label}
                  </p>
                  <p className="text-xs text-zinc-600">{item.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-700 ml-auto group-hover:text-yellow-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
