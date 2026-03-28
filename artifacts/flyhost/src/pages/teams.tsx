import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout";
import { useListTeams, useCreateTeam } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createTeamSchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z.string().min(2, "Slug is required").regex(/^[a-z0-9-]+$/, "Lowercase alphanumeric and dashes only"),
});

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
      toast({ title: "Team created!" });
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Teams</h1>
            <p className="text-muted-foreground mt-1">Collaborate with others on your projects.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-gray-200">
                <Plus className="w-4 h-4 mr-2" /> Create Team
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
              <DialogHeader>
                <DialogTitle>Create a New Team</DialogTitle>
                <DialogDescription>Teams allow you to collaborate on projects.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({field}) => (
                    <FormItem><FormLabel>Team Name</FormLabel><FormControl><Input placeholder="Acme Corp" {...field} className="bg-secondary/50" /></FormControl><FormMessage/></FormItem>
                  )} />
                  <FormField control={form.control} name="slug" render={({field}) => (
                    <FormItem><FormLabel>Team URL Slug</FormLabel><FormControl><Input placeholder="acme-corp" {...field} className="bg-secondary/50" /></FormControl><FormMessage/></FormItem>
                  )} />
                  <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={isPending} className="bg-white text-black hover:bg-gray-200">
                      {isPending ? "Creating..." : "Create Team"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid gap-4"><Card className="h-24 bg-card" /><Card className="h-24 bg-card" /></div>
        ) : teams && teams.length > 0 ? (
          <div className="grid gap-4">
            {teams.map(team => (
              <Card key={team.id} className="bg-card border-border hover:border-white/20 transition-colors">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-lg font-bold text-white">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-white">{team.name}</h3>
                      <p className="text-sm text-muted-foreground">flyhost.app/team/{team.slug}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-border">Manage</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-dashed border-border rounded-xl bg-card/10">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-2">No teams yet</h3>
            <p className="text-muted-foreground mb-6">Create a team to start collaborating.</p>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-white text-black hover:bg-gray-200">
              Create Team
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
