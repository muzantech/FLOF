import { useState } from "react";
import { useRoute, Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout";
import { 
  useGetProject, 
  useListDeployments, 
  useCreateDeployment,
  useListDomains,
  useAddDomain,
  useRemoveDomain,
  useListEnvVars,
  useCreateEnvVar,
  useDeleteEnvVar,
  DeploymentStatus,
  ProjectStatus
} from "@workspace/api-client-react";
import { ProjectStatusBadge, DeploymentStatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Github, ExternalLink, GitBranch, Clock, Terminal, Globe, 
  Lock, Trash2, ArrowUpRight, Play, CheckCircle2, ShieldAlert
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProjectDetailPage() {
  const [, params] = useRoute("/projects/:id");
  const projectId = parseInt(params?.id || "0", 10);
  
  const { data: project, isLoading: projectLoading } = useGetProject(projectId);
  const { data: deployments, isLoading: depsLoading } = useListDeployments(projectId);
  const { data: domains, isLoading: domainsLoading } = useListDomains(projectId);
  const { data: envVars, isLoading: envLoading } = useListEnvVars(projectId);
  
  const { mutateAsync: createDeploy, isPending: deploying } = useCreateDeployment();
  const { mutateAsync: addDomain } = useAddDomain();
  const { mutateAsync: removeDomain } = useRemoveDomain();
  const { mutateAsync: createEnvVar } = useCreateEnvVar();
  const { mutateAsync: deleteEnvVar } = useDeleteEnvVar();
  
  const { toast } = useToast();

  const handleDeploy = async () => {
    try {
      await createDeploy({ projectId, data: { branch: project?.gitBranch || "main", commitMessage: "Manual deployment triggered" } });
      toast({ title: "Deployment started", description: "Check the deployments tab for progress." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Deployment failed", description: error.message });
    }
  };

  if (projectLoading) {
    return <AppLayout><div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div></div></AppLayout>;
  }

  if (!project) {
    return <AppLayout><div className="text-center p-20 text-red-400">Project not found</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border/50">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center border border-border/80 text-2xl font-bold text-white shadow-inner">
              {project.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold flex items-center gap-3">
                {project.name}
                <ProjectStatusBadge status={project.status} />
              </h1>
              <div className="flex items-center gap-3 mt-2 text-muted-foreground text-sm">
                <a href={`https://${project.slug}.flyhost.app`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> {project.slug}.flyhost.app
                </a>
                {project.gitRepo && (
                  <>
                    <span>•</span>
                    <a href={`https://github.com/${project.gitRepo}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-white transition-colors">
                      <Github className="w-3.5 h-3.5" /> {project.gitRepo}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            {project.latestDeploymentUrl && (
              <Button variant="outline" asChild className="bg-secondary/50 border-border">
                <a href={project.latestDeploymentUrl} target="_blank" rel="noreferrer">
                  Visit <ArrowUpRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
            )}
            <Button 
              onClick={handleDeploy} 
              disabled={deploying}
              className="bg-white text-black hover:bg-gray-200 shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all"
            >
              {deploying ? "Starting..." : <><Play className="w-4 h-4 mr-2" /> Deploy</>}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-12 p-0 space-x-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none h-full px-1 text-muted-foreground data-[state=active]:text-white">Overview</TabsTrigger>
            <TabsTrigger value="deployments" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none h-full px-1 text-muted-foreground data-[state=active]:text-white">Deployments</TabsTrigger>
            <TabsTrigger value="domains" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none h-full px-1 text-muted-foreground data-[state=active]:text-white">Domains</TabsTrigger>
            <TabsTrigger value="env" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-white rounded-none h-full px-1 text-muted-foreground data-[state=active]:text-white">Environment</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="mt-8 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-card border-border overflow-hidden">
                  <CardHeader className="bg-secondary/20 border-b border-border/50 pb-4">
                    <CardTitle className="text-lg flex items-center justify-between">
                      Production Deployment
                      {project.latestDeploymentStatus && (
                         <DeploymentStatusBadge status={project.latestDeploymentStatus as DeploymentStatus} />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {deployments && deployments.length > 0 ? (
                      <div className="space-y-6">
                        <div className="aspect-[16/9] bg-secondary/30 rounded-lg border border-border flex items-center justify-center relative overflow-hidden group">
                          <img 
                            src={`https://api.microlink.io/?url=${encodeURIComponent(project.latestDeploymentUrl || `https://${project.slug}.flyhost.app`)}&screenshot=true&embed=screenshot.url`} 
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            alt="Deployment preview"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                             <a href={project.latestDeploymentUrl || '#'} target="_blank" rel="noreferrer" className="px-4 py-2 bg-white text-black rounded-full font-medium flex items-center">
                               Visit Site <ArrowUpRight className="w-4 h-4 ml-1" />
                             </a>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground mb-1">Domains</p>
                            <p className="font-medium text-white truncate">{project.slug}.flyhost.app</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Branch</p>
                            <p className="font-medium text-white flex items-center gap-1">
                              <GitBranch className="w-3 h-3" /> {project.gitBranch || "main"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Commit</p>
                            <p className="font-medium text-white truncate font-mono text-xs mt-0.5">
                              {deployments[0]?.commit?.substring(0, 7) || "manual"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1">Age</p>
                            <p className="font-medium text-white">
                              {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center text-muted-foreground">
                        No deployments yet. Click "Deploy" to create one.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Repository</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {project.gitRepo ? (
                      <a href={`https://github.com/${project.gitRepo}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <Github className="w-5 h-5 text-white" />
                          <span className="font-medium text-sm text-white group-hover:underline">{project.gitRepo}</span>
                        </div>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not connected to Git</p>
                    )}
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Framework</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center font-bold text-xs uppercase text-white/80">
                        {project.framework?.substring(0,3) || 'APP'}
                      </div>
                      <div>
                        <p className="font-medium capitalize text-white">{project.framework || 'Custom'}</p>
                        <p className="text-xs text-muted-foreground">Preset configuration</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* DEPLOYMENTS TAB */}
          <TabsContent value="deployments" className="mt-8">
            <Card className="bg-card border-border overflow-hidden">
              <div className="divide-y divide-border/50">
                {depsLoading ? (
                  <div className="p-6 text-center text-muted-foreground">Loading...</div>
                ) : deployments && deployments.length > 0 ? (
                  deployments.map((dep) => (
                    <Link key={dep.id} href={`/deployments/${dep.id}`}>
                      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/30 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="shrink-0 mt-1 sm:mt-0">
                            <DeploymentStatusBadge status={dep.status} />
                          </div>
                          <div>
                            <div className="font-medium text-white flex items-center gap-2">
                              {dep.commitMessage || "Manual Deployment"}
                              {dep.isProduction && <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">Production</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground font-mono">
                              <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {dep.branch || "main"}</span>
                              {dep.commit && <span>{dep.commit.substring(0, 7)}</span>}
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          {dep.duration && (
                            <span className="text-muted-foreground flex items-center gap-1 hidden sm:flex">
                              <Clock className="w-3.5 h-3.5" /> {dep.duration}s
                            </span>
                          )}
                          <Button variant="ghost" size="sm" className="hidden group-hover:flex">
                            View Logs <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-12 text-center text-muted-foreground">
                    <Terminal className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    No deployments found.
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* DOMAINS TAB */}
          <TabsContent value="domains" className="mt-8 space-y-6">
            <DomainsManager projectId={projectId} domains={domains || []} addDomain={addDomain} removeDomain={removeDomain} />
          </TabsContent>

          {/* ENV VARS TAB */}
          <TabsContent value="env" className="mt-8 space-y-6">
            <EnvVarsManager projectId={projectId} envVars={envVars || []} createEnvVar={createEnvVar} deleteEnvVar={deleteEnvVar} />
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}

// Sub-components for Project Detail Tabs

function DomainsManager({ projectId, domains, addDomain, removeDomain }: any) {
  const [newDomain, setNewDomain] = useState("");
  const { toast } = useToast();

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomain) return;
    try {
      await addDomain({ projectId, data: { name: newDomain } });
      setNewDomain("");
      toast({ title: "Domain added" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Add Domain</CardTitle>
          <CardDescription>Assign a custom domain to this project.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-3">
            <Input 
              placeholder="example.com" 
              value={newDomain} 
              onChange={e => setNewDomain(e.target.value)}
              className="max-w-md bg-secondary/50"
            />
            <Button type="submit" className="bg-white text-black hover:bg-gray-200">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {domains.map((d: any) => (
            <div key={d.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-white">{d.name}</span>
                {d.verified ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs">
                    <ShieldAlert className="w-3 h-3 mr-1" /> Unverified
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeDomain({ domainId: d.id })} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {domains.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No custom domains added yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

const envSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  environment: z.enum(["production", "preview", "development"]),
});

function EnvVarsManager({ projectId, envVars, createEnvVar, deleteEnvVar }: any) {
  const { toast } = useToast();
  const form = useForm({
    resolver: zodResolver(envSchema),
    defaultValues: { key: "", value: "", environment: "production" as any },
  });

  const onSubmit = async (data: any) => {
    try {
      await createEnvVar({ projectId, data });
      form.reset();
      toast({ title: "Environment variable added" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>Provide environment variables to your deployment.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row items-start gap-4">
              <FormField control={form.control} name="key" render={({field}) => (
                <FormItem className="flex-1 w-full"><FormControl><Input placeholder="EXAMPLE_NAME" {...field} className="bg-secondary/50 font-mono text-sm" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="value" render={({field}) => (
                <FormItem className="flex-1 w-full"><FormControl><Input placeholder="value" type="password" {...field} className="bg-secondary/50 font-mono text-sm" /></FormControl></FormItem>
              )} />
              <FormField control={form.control} name="environment" render={({field}) => (
                <FormItem className="w-full sm:w-[150px]">
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="preview">Preview</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <Button type="submit" className="w-full sm:w-auto bg-white text-black hover:bg-gray-200">Add</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {envVars.map((env: any) => (
            <div key={env.id} className="p-4 flex items-center justify-between group">
              <div className="grid grid-cols-3 w-full items-center gap-4 pr-4">
                <div className="font-mono text-sm text-white flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" /> {env.key}
                </div>
                <div className="font-mono text-sm text-muted-foreground tracking-widest">••••••••••</div>
                <div>
                  <Badge variant="outline" className="bg-secondary text-xs">{env.environment}</Badge>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteEnvVar({ projectId, envId: env.id })} className="text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {envVars.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No environment variables defined.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
