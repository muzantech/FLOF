import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import { useUpdateMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name is required"),
});

export default function SettingsPage() {
  const { user } = useAuth();
  const { mutateAsync: updateProfile, isPending } = useUpdateMe();
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user?.name || "" },
  });

  const onSubmit = async (data: any) => {
    try {
      await updateProfile({ data });
      toast({ title: "Profile updated successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and profile settings.</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex items-center gap-6 mb-6">
                  <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold text-white border border-border">
                    {user?.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white mb-1">Avatar</p>
                    <p className="text-sm text-muted-foreground mb-3">Currently using initials. Avatar upload coming soon.</p>
                    <Button type="button" variant="outline" size="sm" disabled>Change Avatar</Button>
                  </div>
                </div>

                <Separator className="bg-border/50" />

                <div className="grid gap-6 sm:grid-cols-2">
                  <FormField control={form.control} name="name" render={({field}) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} className="bg-secondary/50" /></FormControl><FormMessage/></FormItem>
                  )} />
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Username</label>
                    <Input value={user?.username} disabled className="bg-secondary/20 text-muted-foreground cursor-not-allowed" />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium leading-none">Email Address</label>
                    <Input value={user?.email} disabled className="bg-secondary/20 text-muted-foreground cursor-not-allowed" />
                    <p className="text-xs text-muted-foreground mt-2">To change your email, please contact support.</p>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border/50">
                  <Button type="submit" disabled={isPending} className="bg-white text-black hover:bg-gray-200">
                    {isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
