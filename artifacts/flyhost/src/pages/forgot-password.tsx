import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Triangle, Loader2, KeyRound, Mail, Lock, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

type Step = "email" | "code" | "done";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setStep("code");
      setCooldown(60);
      toast({ title: "Code envoyé !", description: "Vérifiez votre boîte email (et le dossier spam)." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    try {
      await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setCooldown(60);
      toast({ title: "Code renvoyé !" });
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!code.trim() || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Erreur", description: "Les mots de passe ne correspondent pas" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ variant: "destructive", title: "Erreur", description: "Minimum 8 caractères requis" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setStep("done");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full bg-yellow-400/4 blur-[120px]" />
        <div className="absolute bottom-[5%] right-[10%] w-[400px] h-[400px] rounded-full bg-yellow-400/3 blur-[100px]" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      <div className="mb-8 flex flex-col items-center gap-3 relative z-10">
        <div className="w-14 h-14 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.3)]">
          <Triangle className="w-7 h-7 fill-black text-black" />
        </div>
        <span className="font-bold text-white text-xl tracking-tight">FlyHost</span>
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-2xl border border-yellow-400/10 bg-zinc-900/80 backdrop-blur-xl p-8 shadow-2xl">

          {/* Step: done */}
          {step === "done" && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Mot de passe réinitialisé !</h2>
              <p className="text-zinc-400 text-sm mb-6">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
              <Button
                onClick={() => setLocation("/login")}
                className="w-full h-11 bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
              >
                Se connecter
              </Button>
            </div>
          )}

          {/* Step: email */}
          {step === "email" && (
            <>
              <div className="text-center mb-7">
                <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-6 h-6 text-yellow-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Mot de passe oublié</h1>
                <p className="text-zinc-400 mt-1.5 text-sm">Entrez votre email pour recevoir un code de réinitialisation</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-300 block mb-1.5">
                    <Mail className="w-3.5 h-3.5 inline mr-1.5" />Adresse email
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="bg-zinc-800/50 border-zinc-700 h-11 focus:border-yellow-400/50 transition-colors"
                    onKeyDown={e => e.key === "Enter" && handleSendCode()}
                  />
                </div>

                <Button
                  onClick={handleSendCode}
                  disabled={isLoading || !email.trim()}
                  className="w-full h-11 bg-yellow-400 text-black hover:bg-yellow-300 font-semibold transition-all"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer le code"}
                </Button>
              </div>

              <div className="mt-6 text-center text-sm text-zinc-500">
                <Link href="/login" className="text-yellow-400 hover:text-yellow-300 font-medium transition-colors flex items-center justify-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion
                </Link>
              </div>
            </>
          )}

          {/* Step: code + new password */}
          {step === "code" && (
            <>
              <div className="text-center mb-7">
                <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-yellow-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Nouveau mot de passe</h1>
                <p className="text-zinc-400 mt-1.5 text-sm">
                  Code envoyé à <strong className="text-white">{email}</strong>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-300 block mb-1.5">Code à 6 chiffres</label>
                  <Input
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="bg-zinc-800/50 border-zinc-700 h-11 focus:border-yellow-400/50 text-center text-xl tracking-widest font-mono transition-colors"
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-300 block mb-1.5">Nouveau mot de passe</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-800/50 border-zinc-700 h-11 focus:border-yellow-400/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-sm text-zinc-300 block mb-1.5">Confirmer le mot de passe</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-zinc-800/50 border-zinc-700 h-11 focus:border-yellow-400/50 transition-colors"
                    onKeyDown={e => e.key === "Enter" && handleReset()}
                  />
                </div>

                <Button
                  onClick={handleReset}
                  disabled={isLoading || code.length !== 6 || !newPassword || !confirmPassword}
                  className="w-full h-11 bg-yellow-400 text-black hover:bg-yellow-300 font-semibold transition-all"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Réinitialiser le mot de passe"}
                </Button>

                <button
                  onClick={handleResend}
                  disabled={isLoading || cooldown > 0}
                  className="w-full text-sm text-zinc-500 hover:text-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le code"}
                </button>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => setStep("email")}
                  className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors flex items-center justify-center gap-1.5 mx-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Changer d'email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
