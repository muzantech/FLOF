import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout";
import { useGetStats, useListProjects, Project } from "@workspace/api-client-react";
import { ProjectStatusBadge, DeploymentStatusBadge } from "@/components/ui/status-badge";
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
  MoreVertical
} from "lucide-react";

function StatCard({ title, value, icon: Icon, loading }: { title: string; value: string | number; icon: any; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-6 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20 bg-secondary" />
      ) : (
        <div className="text-3xl font-display font-bold">{value}</div>
      )}
    </div>
  );
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col h-[200px]">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full bg-secondary" />
          <div>
            <Skeleton className="h-5 w-32 bg-secondary mb-2" />
            <Skeleton className="h-4 w-24 bg-secondary" />
          </div>
        </div>
      </div>
      <div className="mt-auto pt-4 border-t border-border/50">
        <Skeleton className="h-4 w-48 bg-secondary" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: isStatsLoading } = useGetStats();
  const { data: projects, isLoading: isProjectsLoading } = useListProjects();

  const recentProjects = projects?.slice(0, 3) || [];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <Link href="/projects">
            <Button className="bg-white text-black hover:bg-gray-200 shadow-sm">
              <Plus className="w-4 h-4 mr-2" /> New Project
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Projects" 
            value={stats?.totalProjects || 0} 
            icon={Box} 
            loading={isStatsLoading} 
          />
          <StatCard 
            title="Active Deployments" 
            value={stats?.activeDeployments || 0} 
            icon={Activity} 
            loading={isStatsLoading} 
          />
          <StatCard 
            title="Success Rate" 
            value={`${stats?.successRate || 100}%`} 
            icon={CheckCircle2} 
            loading={isStatsLoading} 
          />
          <StatCard 
            title="Custom Domains" 
            value={stats?.totalDomains || 0} 
            icon={Globe} 
            loading={isStatsLoading} 
          />
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Recent Projects</h2>
            <Link href="/projects" className="text-sm text-muted-foreground hover:text-white transition-colors">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isProjectsLoading ? (
              <>
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
              </>
            ) : recentProjects.length > 0 ? (
              recentProjects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="group">
                  <div className="rounded-xl border border-border bg-card p-6 h-full flex flex-col hover:border-white/20 transition-all duration-300 hover:shadow-lg hover:shadow-white/5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center border border-border text-white font-display font-bold">
                          {project.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg leading-none mb-1 group-hover:text-primary transition-colors">
                            {project.name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {project.slug}.flyhost.app
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="mb-4">
                      {project.gitRepo && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Github className="w-4 h-4" />
                          <span>{project.gitRepo}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <ProjectStatusBadge status={project.status} />
                        {project.framework && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground border border-border/50">
                            {project.framework}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className={`w-2 h-2 rounded-full ${
                          project.latestDeploymentStatus === 'ready' ? 'bg-emerald-500' :
                          project.latestDeploymentStatus === 'building' ? 'bg-amber-500 animate-pulse' :
                          project.latestDeploymentStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                        }`}></span>
                        {project.latestDeploymentStatus ? (
                          <span className="capitalize">{project.latestDeploymentStatus}</span>
                        ) : (
                          <span>No deployments</span>
                        )}
                        <span className="mx-1">•</span>
                        <span>{formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</span>
                      </div>
                      
                      {project.latestDeploymentUrl && (
                        <a 
                          href={project.latestDeploymentUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-white p-1"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-12 text-center border border-dashed border-border rounded-xl bg-card/30">
                <Box className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-6">Create your first project to start deploying.</p>
                <Link href="/projects">
                  <Button className="bg-white text-black hover:bg-gray-200">
                    Create Project
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
