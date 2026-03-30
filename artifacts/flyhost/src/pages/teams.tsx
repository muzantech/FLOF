import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import {
  useListTeams,
  useCreateTeam,
  useListTeamMembers,
  useInviteTeamMember,
  useRemoveTeamMember,
  getListTeamsQueryKey,
  getListTeamMembersQueryKey,
} from "@workspace/api-client-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  Users,
  Plus,
  Settings,
  Crown,
  UserPlus,
  FolderGit2,
  Calendar,
  Trash2,
  X,
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

const inviteSchema = z.object({
  email: z.string().email("Email invalide"),
  role: z.enum(["member", "admin", "viewer"]),
});

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Admin",
  member: "Membre",
  viewer: "Lecteur",
};

function InviteDialog({ teamId, onSuccess }: { teamId: number; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: invite, isPending } = useInviteTeamMember();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "member" as const },
  });

  const onSubmit = async (values: any) => {
    try {
      await invite({ teamId, data: { email: values.email, role: values.role } });
      toast({ title: "Membre invité avec succès !" });
      form.reset();
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-xs text-zinc-500 hover:text-yellow-400 gap-1.5 h-7">
          <UserPlus className="w-3 h-3" /> Inviter
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Inviter un membre</DialogTitle>
          <DialogDescription className="text-zinc-500">
            Entrez l'email du compte FlyHost à inviter.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="user@exemple.com"
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-zinc-300">Rôle</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-zinc-800/50 border-zinc-700">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="viewer">Lecteur</SelectItem>
                      <SelectItem value="member">Membre</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-zinc-400">
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
              >
                {isPending ? "Envoi..." : "Inviter"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TeamManageDialog({ team, onDeleted }: { team: any; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: members, refetch: refetchMembers } = useListTeamMembers(team.id, {
    query: { enabled: open },
  });
  const { mutateAsync: removeMember, isPending: removing } = useRemoveTeamMember();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleRemoveMember = async (memberId: number, memberName: string) => {
    try {
      await removeMember({ teamId: team.id, memberId });
      toast({ title: `${memberName} retiré de l'équipe` });
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    }
  };

  const handleDeleteTeam = async () => {
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors de la suppression");
      }
      toast({ title: "Équipe supprimée" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
      onDeleted();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmDelete(false); }}>
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
                <Users className="w-4 h-4 text-zinc-500" />
                Membres {members ? `(${members.length})` : ""}
              </h4>
              {(team.myRole === "owner" || team.myRole === "admin") && (
                <InviteDialog
                  teamId={team.id}
                  onSuccess={() => {
                    refetchMembers();
                    queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
                  }}
                />
              )}
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {!members ? (
                <div className="h-10 rounded-lg bg-zinc-800/50 animate-pulse" />
              ) : members.length === 0 ? (
                <p className="text-sm text-zinc-600 text-center py-3">Aucun membre</p>
              ) : (
                members.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-zinc-800 bg-zinc-800/30"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-zinc-300">
                          {(m.name || m.email || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{m.name || m.username}</p>
                        <p className="text-xs text-zinc-500 truncate">{m.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {m.role === "owner" ? (
                        <div className="flex items-center gap-1 text-xs text-yellow-400">
                          <Crown className="w-3 h-3" />
                          <span>Propriétaire</span>
                        </div>
                      ) : (
                        <>
                          <span className="text-xs text-zinc-500 hidden sm:block">
                            {ROLE_LABELS[m.role] ?? m.role}
                          </span>
                          {(team.myRole === "owner" || team.myRole === "admin" || m.userId === user?.id) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={removing}
                              onClick={() => handleRemoveMember(m.id, m.name || m.email)}
                              className="w-6 h-6 text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Danger zone — owner only */}
          {team.myRole === "owner" && (
            <div className="pt-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-600 mb-2">Zone dangereuse</p>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-red-400 flex-1">Confirmer la suppression ?</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmDelete(false)}
                    className="text-zinc-400 text-xs h-7"
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleDeleteTeam}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs h-7 gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Supprimer
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="border-red-800/40 text-red-400 hover:border-red-500/40 hover:bg-red-500/5 text-xs gap-1.5"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer l'équipe
                </Button>
              )}
            </div>
          )}
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
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: "", slug: "" },
  });

  const nameValue = form.watch("name");

  useEffect(() => {
    if (!nameValue) return;
    const auto = nameValue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    form.setValue("slug", auto, { shouldValidate: false });
  }, [nameValue]);

  const onSubmit = async (data: any) => {
    try {
      await createTeam({ data });
      toast({ title: "Équipe créée !" });
      setIsDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    }
  };

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
                            placeholder="acme-corp"
                            {...field}
                            className="bg-zinc-800/50 border-zinc-700 font-mono focus:border-yellow-400/50"
                          />
                        </FormControl>
                        <p className="text-xs text-zinc-600">
                          flyhost.app/team/{field.value || "slug"}
                        </p>
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
            {teams.map((team: any) => (
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
                      <span>
                        {team.memberCount ?? 1} membre{(team.memberCount ?? 1) > 1 ? "s" : ""}
                      </span>
                    </div>
                    <TeamManageDialog
                      team={team}
                      onDeleted={() => queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() })}
                    />
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
              desc: "Propriétaire, Admin, Membre, Lecteur — contrôlez les accès.",
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
