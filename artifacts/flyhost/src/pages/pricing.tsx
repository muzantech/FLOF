import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Triangle, CheckCircle2, ArrowRight, Coins, Zap, Gift } from "lucide-react";
import { motion } from "framer-motion";

const ACCENT = "#FACC15";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.07, ease: "easeOut" } }),
};

const SERVER_PLANS = [
  { emoji: "🟢", name: "Node.js", coins: 50, desc: "Bots Discord, APIs REST, apps Express, Next.js…" },
  { emoji: "🐍", name: "Python", coins: 50, desc: "Scraping, Machine Learning, Django, Flask…" },
  { emoji: "🐘", name: "PHP", coins: 50, desc: "Sites WordPress, Laravel, scripts PHP…" },
  { emoji: "☕", name: "Java", coins: 75, desc: "Applications Java, Spring Boot, plugins…" },
  { emoji: "⛏️", name: "Minecraft Vanilla", coins: 100, desc: "Serveur Minecraft officiel, vanilla pur." },
  { emoji: "📄", name: "Minecraft Paper", coins: 120, desc: "Serveur optimisé avec support plugins Bukkit/Spigot." },
  { emoji: "⚙️", name: "Minecraft Forge", coins: 150, desc: "Serveur moddé avec support mods Forge." },
  { emoji: "🔫", name: "CS:GO", coins: 150, desc: "Serveur de jeu CS:GO dédié." },
  { emoji: "🎮", name: "Garry's Mod", coins: 100, desc: "Serveur GMod avec addons Steam Workshop." },
  { emoji: "🦀", name: "Rust (jeu)", coins: 200, desc: "Serveur de survie Rust dédié." },
  { emoji: "🎙️", name: "TeamSpeak 3", coins: 30, desc: "Serveur vocal TS3 pour votre communauté." },
];

const COIN_PACKAGES = [
  { id: "coins_100",  coins: 100,  fcfa: "500 FCFA",   badge: null },
  { id: "coins_250",  coins: 250,  fcfa: "1 100 FCFA",  badge: null },
  { id: "coins_500",  coins: 500,  fcfa: "2 000 FCFA",  badge: "Populaire" },
  { id: "coins_1000", coins: 1000, fcfa: "3 500 FCFA",  badge: null },
  { id: "coins_2500", coins: 2500, fcfa: "8 000 FCFA",  badge: "Meilleur rapport" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col">
      {/* Nav */}
      <header className="w-full px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT }}>
            <Triangle className="w-5 h-5 fill-black text-black" />
          </div>
          <span className="font-bold text-xl tracking-tight">FlyHost</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Connexion
          </Link>
          <Link href="/register">
            <Button className="rounded-full font-semibold px-5 h-9 text-sm" style={{ background: ACCENT, color: "#09090B" }}>
              S'inscrire
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4 text-center">
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-6"
            style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}12`, color: ACCENT }}>
            <Coins className="w-3.5 h-3.5" /> Système de coins — payez uniquement ce que vous utilisez
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">
            Des tarifs transparents,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              sans surprises
            </span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            FlyHost utilise un système de coins. Rechargez votre compte avec Mobile Money, puis dépensez vos coins pour créer vos serveurs.
          </p>
        </motion.div>
      </section>

      {/* Essai gratuit */}
      <section className="px-4 pb-8">
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="max-w-3xl mx-auto rounded-3xl border p-8 text-center"
          style={{ borderColor: `${ACCENT}35`, background: `${ACCENT}0A` }}
        >
          <div className="text-4xl mb-3">🎁</div>
          <h2 className="text-xl font-bold mb-2">Essai gratuit 24H — sans carte bancaire</h2>
          <p className="text-zinc-400 text-sm mb-5">
            À la création de votre compte, vous recevez un serveur <strong className="text-white">Node.js gratuit pendant 24 heures</strong> pour tester la plateforme. Aucun engagement.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-400 mb-5">
            {["Serveur Node.js complet", "Sous-domaine .flihost.site inclus", "Console temps réel", "Supprimé automatiquement"].map((t, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {t}
              </span>
            ))}
          </div>
          <Link href="/register">
            <Button className="rounded-full font-bold gap-2" style={{ background: ACCENT, color: "#09090B" }}>
              <Gift className="w-4 h-4" /> Activer mon essai gratuit
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Packages de coins */}
      <section className="py-16 px-4 border-t border-zinc-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Recharger des coins</h2>
            <p className="text-zinc-400">Payez en FCFA avec Orange Money, Wave, ou Mobile Money. Instantané.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {COIN_PACKAGES.map(({ coins, fcfa, badge }, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i * 0.5}
                className={`relative rounded-2xl border p-6 flex flex-col items-center text-center ${
                  badge ? "border-yellow-400/40 bg-yellow-400/5" : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                {badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ background: ACCENT, color: "#09090B" }}>{badge}</span>
                )}
                <Coins className="w-8 h-8 mb-3" style={{ color: ACCENT }} />
                <div className="text-3xl font-black mb-1">{coins.toLocaleString()}</div>
                <div className="text-xs text-zinc-400 mb-3">coins</div>
                <div className="text-sm font-bold text-white">{fcfa}</div>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-zinc-600 mt-4">
            1 coin ≈ 5 FCFA selon le package. Plus vous achetez, plus c'est avantageux.
          </p>
        </div>
      </section>

      {/* Prix des serveurs */}
      <section className="py-16 px-4 border-t border-zinc-900 bg-zinc-950/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Coût des serveurs</h2>
            <p className="text-zinc-400">Coût mensuel par type de serveur (renouvelé automatiquement chaque mois).</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {SERVER_PLANS.map(({ emoji, name, coins, desc }, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i % 3 * 0.5}
                className="flex gap-4 p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 transition-colors"
              >
                <div className="text-2xl flex-shrink-0 mt-0.5">{emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-sm">{name}</p>
                    <span className="text-sm font-black" style={{ color: ACCENT }}>{coins} <span className="text-xs font-normal text-zinc-500">coins/mois</span></span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Questions fréquentes</h2>
          <div className="space-y-5">
            {[
              {
                q: "C'est quoi des coins ?",
                a: "Les coins sont la monnaie virtuelle de FlyHost. Vous les achetez avec de l'argent réel (Orange Money, Wave…) et les dépensez pour créer et renouveler vos serveurs.",
              },
              {
                q: "Comment est facturé l'abonnement ?",
                a: "Chaque serveur coûte X coins par mois. Les coins sont déduits automatiquement chaque mois. Si votre solde est insuffisant, le serveur est suspendu (avec alerte email 3 jours avant).",
              },
              {
                q: "Puis-je annuler à tout moment ?",
                a: "Oui. Supprimez votre serveur quand vous voulez depuis le dashboard. Aucun remboursement des coins déjà consommés, mais les coins restants restent sur votre compte.",
              },
              {
                q: "Quel est le sous-domaine inclus ?",
                a: "Chaque serveur reçoit automatiquement un sous-domaine de la forme `votre-nom.flihost.site` avec SSL. Vous pouvez aussi connecter votre propre domaine.",
              },
              {
                q: "Comment fonctionne l'essai gratuit ?",
                a: "À l'inscription, chaque compte peut créer 1 serveur Node.js gratuit valable 24 heures. Il est supprimé automatiquement à l'expiration. Aucune carte bancaire requise.",
              },
            ].map(({ q, a }, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i * 0.5}
                className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/30"
              >
                <p className="font-bold mb-2">{q}</p>
                <p className="text-zinc-400 text-sm leading-relaxed">{a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 text-center">
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Prêt à commencer ?</h2>
          <p className="text-zinc-400 mb-8">10 coins offerts à l'inscription + 1 serveur d'essai gratuit 24H.</p>
          <Link href="/register">
            <Button size="lg" className="rounded-full h-12 px-10 font-bold gap-2" style={{ background: ACCENT, color: "#09090B" }}>
              Créer mon compte <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: ACCENT }}>
              <Triangle className="w-4 h-4 fill-black text-black" />
            </div>
            <span className="font-bold">FlyHost</span>
          </Link>
          <nav className="flex flex-wrap gap-5 text-sm text-zinc-500">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Documentation</Link>
            <Link href="/status" className="hover:text-white transition-colors">Statut</Link>
          </nav>
          <p className="text-xs text-zinc-600">© 2026 FlyHost. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
