import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Triangle, Loader2, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await login(data);
      if (result?.dailyCoins && result.dailyCoins > 0) {
        toast({
          title: `+${result.dailyCoins} coins gagnés ! ☀️`,
          description: "Bonus de connexion quotidienne ajouté à votre solde.",
          duration: 5000,
        });
      } else {
        toast({ title: "Bienvenue !", description: "Connexion réussie." });
      }
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Connexion échouée",
        description: error.message || "Identifiants invalides",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-yellow-400/4 blur-[120px]" />
        <div className="absolute bottom-[5%] right-[10%] w-[400px] h-[400px] rounded-full bg-yellow-400/3 blur-[100px]" />
      </div>
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      <Link href="/" className="mb-8 flex flex-col items-center gap-3 group cursor-pointer relative z-10">
        <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300 shadow-[0_0_30px_rgba(250,204,21,0.3)]">
          <Triangle className="w-7 h-7 fill-black text-black" />
        </div>
        <span className="font-bold text-white text-xl tracking-tight">FlyHost</span>
      </Link>

      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl border border-yellow-400/10 bg-zinc-900/80 backdrop-blur-xl p-8 shadow-2xl">
          <div className="text-center mb-7">
            <h1 className="text-2xl font-bold text-white">Se connecter</h1>
            <p className="text-zinc-400 mt-1.5 text-sm">Accédez à votre espace FlyHost</p>
          </div>

          {/* Daily coins hint */}
          <div className="flex items-center gap-2 px-3 py-2.5 mb-5 rounded-lg bg-yellow-400/5 border border-yellow-400/15 text-xs text-yellow-400">
            <Coins className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Gagnez <strong>5 coins</strong> en vous connectant chaque jour !</span>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="vous@exemple.com"
                        {...field}
                        className="bg-zinc-800/50 border-zinc-700 h-11 focus:border-yellow-400/50 transition-colors"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                        className="bg-zinc-800/50 border-zinc-700 h-11 focus:border-yellow-400/50 transition-colors"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 bg-yellow-400 text-black hover:bg-yellow-300 font-semibold mt-2 transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Se connecter"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-zinc-500">
            Pas encore de compte ?{" "}
            <Link href="/register" className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors">
              S'inscrire
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
