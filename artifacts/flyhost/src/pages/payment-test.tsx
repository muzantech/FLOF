import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function useQuery() {
  return new URLSearchParams(window.location.search);
}

export default function PaymentTestPage() {
  const [, navigate] = useLocation();
  const query = useQuery();
  const paymentId = query.get("id");
  const [status, setStatus] = useState<"idle" | "confirming" | "done" | "error">("idle");
  const [info, setInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!paymentId) { navigate("/dashboard"); return; }
    fetch(`/api/payment/status/${paymentId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setInfo(d))
      .catch(() => {});
  }, [paymentId]);

  async function confirmTest() {
    if (!paymentId) return;
    setStatus("confirming");
    try {
      const res = await fetch("/api/payment/test-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("done");
        setTimeout(() => navigate(`/payment/callback?id=${paymentId}`), 1500);
      } else {
        setErrorMsg(data.error || "Erreur lors de la confirmation");
        setStatus("error");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Erreur réseau");
      setStatus("error");
    }
  }

  const meta = info?.metadata as any || {};
  const isSubscription = info?.type === "subscription";
  const amount = info?.amount;
  const currency = info?.currency || "XOF";

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6">
        <div className="bg-zinc-900 border border-yellow-500/20 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#FACC15]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Mode Test</h1>
              <p className="text-zinc-500 text-xs">Simulation de paiement</p>
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-6">
            <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Environnement de test</p>
            <p className="text-zinc-400 text-sm">
              Le système de paiement MoneyFusion est en cours de configuration. Utilisez ce mode pour tester le flux de paiement.
            </p>
          </div>

          {info && (
            <div className="mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Type</span>
                <span className="text-white capitalize">{isSubscription ? "Abonnement" : "Coins"}</span>
              </div>
              {isSubscription ? (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Plan</span>
                  <span className="text-[#FACC15] font-semibold">{meta.label}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Coins</span>
                  <span className="text-[#FACC15] font-semibold">{meta.coins} 🪙</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Montant</span>
                <span className="text-white">{amount} {currency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Référence</span>
                <span className="text-zinc-400 font-mono text-xs">{paymentId?.substring(0, 16)}...</span>
              </div>
            </div>
          )}

          {status === "done" ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-green-400 font-semibold">Paiement simulé avec succès !</p>
              <p className="text-zinc-500 text-sm mt-1">Redirection...</p>
            </div>
          ) : status === "error" ? (
            <div className="space-y-3">
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm">{errorMsg}</p>
              </div>
              <button
                onClick={() => setStatus("idle")}
                className="w-full py-2.5 rounded-lg border border-zinc-700 text-white text-sm hover:bg-zinc-800 transition-colors"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={confirmTest}
                disabled={status === "confirming"}
                className="w-full py-3 rounded-xl bg-[#FACC15] text-black font-bold hover:bg-yellow-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === "confirming" ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Confirmation...
                  </>
                ) : (
                  "✓ Simuler le paiement"
                )}
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
