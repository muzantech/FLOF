import { useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { AppLayout } from "@/components/layout";
import { 
  useGetDeployment, 
  useGetDeploymentLogs,
  usePromoteDeployment,
  DeploymentStatus
} from "@workspace/api-client-react";
import { DeploymentStatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ExternalLink, GitCommit, GitBranch, Clock, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DeploymentDetailPage() {
  const [, params] = useRoute("/deployments/:id");
  const deploymentId = parseInt(params?.id || "0", 10);
  
  // Polling every 3s if status is building/queued
  const { data: deployment, isLoading: depLoading, refetch: refetchDep } = useGetDeployment(deploymentId);
  const isPending = deployment?.status === 'building' || deployment?.status === 'queued';
  
  useEffect(() => {
    if (isPending) {
      const interval = setInterval(refetchDep, 3000);
      return () => clearInterval(interval);
    }
  }, [isPending, refetchDep]);

  const { data: logs, refetch: refetchLogs } = useGetDeploymentLogs(deploymentId);
  
  useEffect(() => {
    if (isPending) {
      const interval = setInterval(refetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [isPending, refetchLogs]);

  const { mutateAsync: promote, isPending: promoting } = usePromoteDeployment();
  const { toast } = useToast();
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handlePromote = async () => {
    try {
      await promote({ deploymentId });
      toast({ title: "Promoted to production!" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to promote", description: e.message });
    }
  };

  if (depLoading) return <AppLayout><div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div></div></AppLayout>;
  if (!deployment) return <AppLayout><div className="text-center p-20 text-red-400">Deployment not found</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <Link href={`/projects/${deployment.projectId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Project
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border/50">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-display font-bold">Deployment Detail</h1>
              <DeploymentStatusBadge status={deployment.status} />
              {deployment.isProduction && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">Production</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {deployment.url && (
                <a href={deployment.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-white hover:underline">
                  {deployment.url.replace('https://', '')} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" /> {deployment.branch || "main"}</span>
              {deployment.commit && <span className="flex items-center gap-1"><GitCommit className="w-3.5 h-3.5" /> {deployment.commit.substring(0,7)}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {formatDistanceToNow(new Date(deployment.createdAt), {addSuffix: true})}</span>
              {deployment.duration && <span>{deployment.duration}s</span>}
            </div>
          </div>
          
          <div className="flex gap-3">
            {deployment.status === 'ready' && !deployment.isProduction && (
              <Button onClick={handlePromote} disabled={promoting} className="bg-white text-black hover:bg-gray-200">
                {promoting ? "Promoting..." : <><ArrowUpRight className="w-4 h-4 mr-2" /> Promote to Production</>}
              </Button>
            )}
          </div>
        </div>

        {/* Status Pipeline Visualizer */}
        <div className="py-8 flex justify-center">
          <div className="flex items-center w-full max-w-2xl">
            <PipelineStep title="Queued" active={true} done={deployment.status !== 'queued'} />
            <PipelineLine active={deployment.status !== 'queued'} />
            <PipelineStep title="Building" active={deployment.status !== 'queued'} done={deployment.status === 'ready' || deployment.status === 'error'} isError={deployment.status === 'error'} pulse={deployment.status === 'building'} />
            <PipelineLine active={deployment.status === 'ready' || deployment.status === 'error'} isError={deployment.status === 'error'} />
            <PipelineStep title="Ready" active={deployment.status === 'ready'} done={deployment.status === 'ready'} />
          </div>
        </div>

        {/* Logs Terminal */}
        <Card className="bg-black border-border shadow-2xl overflow-hidden rounded-xl">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#111] border-b border-border/50 text-xs text-muted-foreground font-mono">
            <div className="flex gap-1.5 mr-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
            </div>
            Build Logs
          </div>
          <div className="p-4 font-mono text-[13px] leading-relaxed h-[500px] overflow-y-auto bg-[#0a0a0a]">
            {logs && logs.length > 0 ? (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded -mx-2">
                    <span className="text-muted-foreground/50 w-20 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString([], {hour12:false, hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                    </span>
                    <span className={`${
                      log.level === 'error' ? 'text-red-400' :
                      log.level === 'warn' ? 'text-amber-400' :
                      'text-gray-300'
                    } whitespace-pre-wrap break-all`}>
                      {log.message}
                    </span>
                  </div>
                ))}
                {isPending && (
                  <div className="flex gap-4 px-2 py-0.5 animate-pulse">
                    <span className="text-muted-foreground/50 w-20 shrink-0">...</span>
                    <span className="text-emerald-400">Building...</span>
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            ) : (
              <div className="text-muted-foreground/50 flex h-full items-center justify-center">
                {isPending ? "Waiting for logs..." : "No logs available."}
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function PipelineStep({ title, active, done, isError, pulse }: any) {
  return (
    <div className="flex flex-col items-center gap-2 relative z-10">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
        isError ? 'border-red-500 bg-red-500/20 text-red-500' :
        done ? 'border-emerald-500 bg-emerald-500 text-black' :
        active ? 'border-white bg-white text-black' :
        'border-border bg-card text-muted-foreground'
      } ${pulse ? 'animate-pulse shadow-[0_0_15px_rgba(255,255,255,0.3)]' : ''}`}>
        {done && !isError ? <CheckCircle2 className="w-5 h-5" /> : <div className="w-2.5 h-2.5 rounded-full bg-current"></div>}
      </div>
      <span className={`text-xs font-medium absolute -bottom-6 whitespace-nowrap ${
        isError ? 'text-red-500' :
        active || done ? 'text-white' : 'text-muted-foreground'
      }`}>{title}</span>
    </div>
  );
}

function PipelineLine({ active, isError }: any) {
  return (
    <div className="flex-1 h-0.5 bg-border relative overflow-hidden mx-2">
      <div className={`absolute top-0 left-0 h-full w-full origin-left transition-transform duration-1000 ${
        active ? 'scale-x-100' : 'scale-x-0'
      } ${isError ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
    </div>
  );
}
