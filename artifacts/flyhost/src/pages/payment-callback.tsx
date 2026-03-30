import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const accent = "#FACC15";

function useQuery() {
  const params = new URLSearchParams(window.location.search);
  return params;
}

export default function PaymentCallbackPage() {
  const [, navigate] = useLocation();
  const query = useQuery();
  const paymentId = query.get("id");
  const [status, setStatus] = useState<"loading" | "completed" | "failed" | "pending">("loading");
  const [info, setInfo] = useState<any>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!paymentId) {
      navigate("/dashboard");
      return;
    }

    let stopped = false;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/payment/status/${paymentId}`);
        if (!res.ok) { setStatus("failed"); return; }
        const data = await res.json();
        setInfo(data);
        if (data.status === "completed") {
          setStatus("completed");
        } else if (data.status === "failed") {
          setStatus("failed");
        } else {
          setStatus("pending");
          setAttempts(a => a + 1);
          if (!stopped) setTimeout(checkStatus, 3000);
        }
      } catch {
        setStatus("failed");
      }
    }

    checkStatus();
    return () => { stopped = true; };
  }, [paymentId, navigate]);

  function goToDashboard() {
    navigate("/dashboard");
  }

  function goToSubscription() {
    navigate("/subscription");
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#FACC15] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Vérification du paiement...</p>
        </div>
      </div>
    );
  }

  if (status === "pending" && attempts < 20) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-12 h-12 border-2 border-[#FACC15] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">Paiement en cours de traitement</h2>
          <p className="text-zinc-400 mb-2">Nous attendons la confirmation de votre paiement...</p>
          <p className="text-zinc-600 text-sm">Tentative {attempts}/20</p>
          <button
            onClick={goToDashboard}
            className="mt-6 text-sm text-zinc-500 underline hover:text-white"
          >
            Retourner au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  if (status === "completed") {
    const meta = info?.metadata as any || {};
    const isSubscription = info?.type === "subscription";
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Paiement confirmé !</h1>
          {isSubscription ? (
            <p className="text-zinc-400 mb-2">
              Votre abonnement <strong className="text-[#FACC15]">{meta.label}</strong> est maintenant actif.
            </p>
          ) : (
            <p className="text-zinc-400 mb-2">
              <strong className="text-[#FACC15]">{meta.coins} coins</strong> ont été ajoutés à votre compte.
            </p>
          )}
          <p className="text-zinc-600 text-sm mb-8">Référence : {paymentId?.substring(0, 8)}...</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={goToDashboard}
              className="px-6 py-2.5 rounded-lg bg-[#FACC15] text-black font-semibold hover:bg-yellow-300 transition-colors"
            >
              Tableau de bord
            </button>
            {!isSubscription && (
              <button
                onClick={goToSubscription}
                className="px-6 py-2.5 rounded-lg border border-zinc-700 text-white font-semibold hover:bg-zinc-800 transition-colors"
              >
                Voir les abonnements
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Paiement échoué</h1>
        <p className="text-zinc-400 mb-8">
          Votre paiement n'a pas pu être confirmé. Aucun montant n'a été débité.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={goToDashboard}
            className="px-6 py-2.5 rounded-lg border border-zinc-700 text-white font-semibold hover:bg-zinc-800 transition-colors"
          >
            Tableau de bord
          </button>
          <button
            onClick={() => navigate("/subscription")}
            className="px-6 py-2.5 rounded-lg bg-[#FACC15] text-black font-semibold hover:bg-yellow-300 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  );
}
