import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Triangle, Loader2, Gift } from "lucide-react";
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

const registerSchema = z.object({
  name: z.string().min(2, "Nom requis"),
  username: z
    .string()
    .min(3, "Minimum 3 caractères")
    .regex(/^[a-z0-9-]+$/, "Minuscules, chiffres et tirets uniquement"),
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(6, "Minimum 6 caractères"),
  referralCode: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read referral code from URL
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get("ref") || "";

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", username: "", email: "", password: "", referralCode: refCode },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      await register(data as any);
      toast({
        title: "Compte créé ! 🎉",
        description: "Vérifiez votre email pour activer votre compte.",
        duration: 6000,
      });
      setLocation("/verify-email");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Inscription échouée",
        description: error.message || "Une erreur est survenue",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col justify-center items-center p-4 py-12 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[5%] right-[10%] w-[500px] h-[500px] rounded-full bg-yellow-400/4 blur-[130px]" />
        <div className="absolute bottom-[5%] left-[10%] w-[400px] h-[400px] rounded-full bg-yellow-400/3 blur-[100px]" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      <Link href="/" className="mb-7 flex flex-col items-center gap-3 group cursor-pointer relative z-10">
        <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center transform group-hover:scale-105 transition-transform shadow-[0_0_30px_rgba(250,204,21,0.3)]">
          <Triangle className="w-7 h-7 fill-black text-black" />
        </div>
        <span className="font-bold text-white text-xl tracking-tight">FlyHost</span>
      </Link>

      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl border border-yellow-400/10 bg-zinc-900/80 backdrop-blur-xl p-8 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">Créer un compte</h1>
            <p className="text-zinc-400 mt-1.5 text-sm">Rejoignez FlyHost et déployez vos apps</p>
          </div>

          {/* Welcome bonus hint */}
          <div className="flex items-center gap-2 px-3 py-2.5 mb-5 rounded-lg bg-yellow-400/5 border border-yellow-400/15 text-xs text-yellow-400">
            <Gift className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Recevez <strong>10 coins</strong> de bienvenue à l'inscription !</span>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Nom complet</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Jean Dupont"
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Nom d'utilisateur</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="jeandupont"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-zinc-300">Email</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="jean@exemple.com"
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
                        autoComplete="new-password"
                        {...field}
                        className="bg-zinc-800/50 border-zinc-700 h-11 focus:border-yellow-400/50 transition-colors"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {refCode && (
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Code de parrainage</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-zinc-800/50 border-zinc-700 h-11 text-yellow-400 font-mono"
                          readOnly
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-yellow-400 text-black hover:bg-yellow-300 font-semibold mt-2 transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Créer mon compte"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-zinc-500">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
