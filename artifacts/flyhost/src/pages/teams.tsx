import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout";
import { useListTeams, useCreateTeam, useListProjects } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Users,
  Plus,
  Settings,
  Crown,
  UserPlus,
  FolderGit2,
  ArrowRight,
  Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";

const createTeamSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  slug: z
    .string()
    .min(2, "Slug requis")
    .regex(/^[a-z0-9-]+$/, "Minuscules, chiffres et tirets uniquement"),
});

function TeamManageDialog({ team }: { team: any }) {
  const { data: projects } = useListProjects();
  const { user } = useAuth();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-zinc-700 hover:border-yellow-400/40 hover:text-yellow-400 text-xs gap-1.5"
        >
          <Settings className="w-3.5 h-3.5" /> Gérer
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
              <span className="text-sm font-bold text-yellow-400">{team.name.charAt(0).toUpperCase()}</span>
            </div>
            {team.name}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            flyhost.app/team/{team.slug}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Team info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 text-sm">
            <Calendar className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-400">
              Créée {formatDistanceToNow(new Date(team.createdAt), { addSuffix: true, locale: fr })}
            </span>
          </div>

          {/* Members section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-500" /> Membres
              </h4>
              <Button size="sm" variant="ghost" className="text-xs text-zinc-500 hover:text-yellow-400 gap-1.5 h-7">
                <UserPlus className="w-3 h-3" /> Inviter
              </Button>
            </div>
            <div className="space-y-2">
              {/* Owner (current user) */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-yellow-400">{user?.name?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{user?.name}</p>
                    <p className="text-xs text-zinc-500">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <Crown className="w-3 h-3" /> Propriétaire
                </div>
              </div>
            </div>
          </div>

          {/* Projects section */}
          <div>
            <h4 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
              <FolderGit2 className="w-4 h-4 text-zinc-500" /> Projets de l'équipe
            </h4>
            {projects && projects.length > 0 ? (
              <div className="space-y-2">
                {projects.slice(0, 3).map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-800 bg-zinc-800/20 text-sm">
                    <span className="text-zinc-300">{project.name}</span>
                    <span className="text-xs text-zinc-600">{project.slug}.flyhost.app</span>
                  </div>
                ))}
                {projects.length > 3 && (
                  <p className="text-xs text-zinc-600 text-center">+{projects.length - 3} autres projets</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-600 text-center py-3">Aucun projet associé</p>
            )}
          </div>

          {/* Danger zone */}
          <div className="pt-3 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 mb-2">Zone dangereuse</p>
            <Button
              variant="outline"
              size="sm"
              className="border-red-800/40 text-red-400 hover:border-red-500/40 hover:bg-red-500/5 text-xs"
            >
              Supprimer l'équipe
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: teams, isLoading } = useListTeams();
  const { mutateAsync: createTeam, isPending } = useCreateTeam();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: "", slug: "" },
  });

  const onSubmit = async (data: any) => {
    try {
      await createTeam({ data });
      toast({ title: "Équipe créée !" });
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

  // Auto-fill slug from name
  const nameValue = form.watch("name");
  const autoSlug = nameValue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Équipes</h1>
            <p className="text-zinc-500 text-sm mt-1">Collaborez avec d'autres développeurs sur vos projets.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold gap-2">
                <Plus className="w-4 h-4" /> Créer une équipe
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-white">Nouvelle équipe</DialogTitle>
                <DialogDescription className="text-zinc-500">
                  Créez une équipe pour collaborer sur vos projets.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Nom de l'équipe</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Acme Corp"
                            {...field}
                            className="bg-zinc-800/50 border-zinc-700 focus:border-yellow-400/50"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-300">Identifiant URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={autoSlug || "acme-corp"}
                            {...field}
                            className="bg-zinc-800/50 border-zinc-700 font-mono focus:border-yellow-400/50"
                          />
                        </FormControl>
                        <p className="text-xs text-zinc-600">flyhost.app/team/{field.value || autoSlug || "slug"}</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
                    >
                      {isPending ? "Création..." : "Créer l'équipe"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl border border-zinc-800 bg-zinc-900/50 animate-pulse" />
            ))}
          </div>
        ) : teams && teams.length > 0 ? (
          <div className="space-y-3">
            {teams.map((team) => (
              <Card key={team.id} className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-lg font-bold text-yellow-400">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{team.name}</h3>
                      <p className="text-sm text-zinc-500">flyhost.app/team/{team.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-600 mr-2">
                      <Users className="w-3.5 h-3.5" />
                      <span>1 membre</span>
                    </div>
                    <TeamManageDialog team={team} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-zinc-600" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Aucune équipe</h3>
            <p className="text-zinc-500 text-sm mb-6">Créez une équipe pour commencer à collaborer.</p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" /> Créer une équipe
            </Button>
          </div>
        )}

        {/* Collaboration features info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          {[
            {
              icon: Users,
              title: "Membres illimités",
              desc: "Invitez autant de membres que vous voulez dans vos équipes.",
            },
            {
              icon: FolderGit2,
              title: "Projets partagés",
              desc: "Tous les membres d'une équipe accèdent aux mêmes projets.",
            },
            {
              icon: Crown,
              title: "Rôles & permissions",
              desc: "Propriétaire, Admin, Développeur — contrôlez les accès.",
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30"
            >
              <feat.icon className="w-5 h-5 text-yellow-400 mb-3" />
              <h4 className="text-sm font-semibold text-white mb-1">{feat.title}</h4>
              <p className="text-xs text-zinc-500 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
