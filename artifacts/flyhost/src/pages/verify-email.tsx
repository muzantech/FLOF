import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Triangle, Loader2, Mail, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (user?.emailVerified) {
      setLocation("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async () => {
    if (!code.trim()) return;
    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setVerified(true);
      toast({ title: "Email vérifié ! +5 coins offerts 🎉" });
      await refreshUser();
      setTimeout(() => setLocation("/dashboard"), 2000);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast({ title: "Code envoyé !", description: "Vérifiez votre boîte email." });
      setCooldown(60);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsSending(false);
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

          {verified ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Email vérifié !</h2>
              <p className="text-zinc-400 text-sm">+5 coins ajoutés à votre compte. Redirection...</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <div className="w-12 h-12 bg-yellow-400/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-yellow-400" />
                </div>
                <h1 className="text-2xl font-bold text-white">Vérification email</h1>
                <p className="text-zinc-400 mt-1.5 text-sm">
                  Un code à 6 chiffres a été envoyé à{" "}
                  <strong className="text-white">{user?.email}</strong>
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-zinc-300 block mb-1.5">Code de vérification</label>
                  <Input
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    maxLength={6}
                    className="bg-zinc-800/50 border-zinc-700 h-11 focus:border-yellow-400/50 text-center text-xl tracking-widest font-mono transition-colors"
                    onKeyDown={e => e.key === "Enter" && handleVerify()}
                  />
                </div>

                <Button
                  onClick={handleVerify}
                  disabled={isVerifying || code.length !== 6}
                  className="w-full h-11 bg-yellow-400 text-black hover:bg-yellow-300 font-semibold transition-all"
                >
                  {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Vérifier mon email"}
                </Button>

                <button
                  onClick={handleResend}
                  disabled={isSending || cooldown > 0}
                  className="w-full flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSending ? "animate-spin" : ""}`} />
                  {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le code"}
                </button>
              </div>

              <div className="mt-5 px-3 py-2.5 rounded-lg bg-yellow-400/5 border border-yellow-400/15 text-xs text-yellow-400 text-center">
                Vérifiez votre dossier spam si vous ne recevez pas l'email
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
