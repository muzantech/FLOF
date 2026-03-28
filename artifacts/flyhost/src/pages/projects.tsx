import { useState } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { ProjectStatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Github, ExternalLink, Search, SearchX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createProjectSchema = z.object({
  name: z.string().min(2, "Project name is required").regex(/^[a-z0-9-]+$/, "Lowercase alphanumeric and dashes only"),
  framework: z.string().optional(),
  gitRepo: z.string().optional(),
});

type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [, navigate] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: projects, isLoading } = useListProjects();
  const { mutateAsync: createProject, isPending } = useCreateProject();
  const { toast } = useToast();

  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", framework: "nextjs", gitRepo: "" },
  });

  const onSubmit = async (data: CreateProjectFormValues) => {
    try {
      await createProject({ data });
      toast({ title: "Project created", description: "Your project is ready to deploy." });
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to create",
        description: error.message || "An error occurred",
      });
    }
  };

  const filteredProjects = projects?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-display font-bold">Projects</h1>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-gray-200">
                <Plus className="w-4 h-4 mr-2" /> Add New...
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Setup a new project from a Git repository or template.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="my-awesome-app" {...field} className="bg-secondary/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="framework"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Framework</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-secondary/50">
                              <SelectValue placeholder="Select a framework" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="nextjs">Next.js</SelectItem>
                            <SelectItem value="react">Create React App</SelectItem>
                            <SelectItem value="vite">Vite</SelectItem>
                            <SelectItem value="vue">Vue</SelectItem>
                            <SelectItem value="svelte">SvelteKit</SelectItem>
                            <SelectItem value="other">Other / HTML</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gitRepo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Git Repository (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="username/repo" {...field} className="bg-secondary/50" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isPending} className="bg-white text-black hover:bg-gray-200">
                      {isPending ? "Creating..." : "Create Project"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/30 border-border/50 h-10"
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-card" />
            ))}
          </div>
        ) : filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 rounded-xl border border-border bg-card/40 hover:bg-card hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                  <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center border border-border text-lg font-bold text-white shrink-0">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                      {project.name}
                      <ProjectStatusBadge status={project.status} />
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1 text-sm text-muted-foreground">
                      <span>{project.slug}.flyhost.app</span>
                      {project.gitRepo && (
                        <span className="flex items-center gap-1">
                          <Github className="w-3 h-3" /> {project.gitRepo}
                        </span>
                      )}
                      {project.framework && (
                        <span className="px-2 py-0.5 rounded bg-secondary/50 text-xs">
                          {project.framework}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right hidden md:block">
                    <div className="flex items-center justify-end gap-2 text-muted-foreground mb-1">
                      <span className={`w-2 h-2 rounded-full ${
                        project.latestDeploymentStatus === "ready" ? "bg-emerald-500" :
                        project.latestDeploymentStatus === "building" ? "bg-amber-500 animate-pulse" :
                        project.latestDeploymentStatus === "error" ? "bg-red-500" : "bg-gray-500"
                      }`} />
                      <span className="capitalize">{project.latestDeploymentStatus || "No deployments"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground/70">
                      {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                    </span>
                  </div>

                  {project.latestDeploymentUrl && (
                    <a
                      href={project.latestDeploymentUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-white shrink-0"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-dashed border-border rounded-xl bg-card/10">
            <SearchX className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">No projects found</h3>
            <p className="text-muted-foreground">
              {search ? "Try adjusting your search query." : "You haven't created any projects yet."}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
