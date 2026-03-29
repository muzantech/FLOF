import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Triangle, Zap, Shield, Globe, Terminal, ArrowRight,
  Coins, Gift, Activity, Server, CheckCircle2, Users,
  Clock, Star, ChevronRight
} from "lucide-react";
import { motion } from "framer-motion";

const ACCENT = "#FACC15";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.08, ease: "easeOut" } }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white flex flex-col overflow-hidden relative">
      {/* Background glow */}
      <div className="absolute inset-0 z-0 opacity-30 pointer-events-none select-none">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-glow.png`}
          alt=""
          className="w-full h-[80vh] object-cover mix-blend-screen"
        />
      </div>
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* ── Nav ──────────────────────────────────────────── */}
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT }}>
            <Triangle className="w-5 h-5 fill-black text-black" />
          </div>
          <span className="font-bold text-xl tracking-tight">FlyHost</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Documentation</Link>
          <Link href="/status" className="hover:text-white transition-colors">Statut</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Connexion
          </Link>
          <Link href="/register">
            <Button className="rounded-full font-semibold px-5 h-9 text-sm" style={{ background: ACCENT, color: "#09090B" }}>
              Commencer gratuitement
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 text-center mt-16 mb-24">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold"
            style={{ borderColor: `${ACCENT}40`, background: `${ACCENT}12`, color: ACCENT }}>
            <Gift className="w-3.5 h-3.5" /> Serveur d'essai gratuit 24H — sans carte bancaire
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp} initial="hidden" animate="visible" custom={1}
          className="text-5xl sm:text-6xl md:text-8xl font-bold tracking-tighter leading-[1.05] mb-6 max-w-5xl"
        >
          Hébergez vos apps.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            Simplement.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp} initial="hidden" animate="visible" custom={2}
          className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light"
        >
          FlyHost vous donne un serveur Node.js, Python, PHP ou Minecraft en quelques secondes.
          Payez en coins — rechargés avec Mobile Money (Orange, Wave…).
        </motion.p>

        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={3}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link href="/register">
            <Button size="lg" className="rounded-full h-13 px-8 text-base font-bold w-full sm:w-auto gap-2"
              style={{ background: ACCENT, color: "#09090B" }}>
              Démarrer gratuitement <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button size="lg" variant="outline" className="rounded-full h-13 px-8 text-base border-zinc-800 bg-transparent hover:bg-white/5 w-full sm:w-auto">
              Voir les tarifs
            </Button>
          </Link>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={4}
          className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-zinc-500"
        >
          {[
            { icon: Users, text: "79+ utilisateurs" },
            { icon: Server, text: "Serveurs actifs 24/7" },
            { icon: Shield, text: "Cloudflare DDoS protection" },
            { icon: Star, text: "Sous-domaine gratuit inclus" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-zinc-600" />
              <span>{text}</span>
            </div>
          ))}
        </motion.div>
      </main>

      {/* ── Comment ça marche ────────────────────────────── */}
      <section className="relative z-10 py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Simple par conception</p>
            <h2 className="text-3xl md:text-4xl font-bold">Déployé en 3 étapes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[33%] right-[33%] h-px bg-gradient-to-r from-zinc-800 via-yellow-400/30 to-zinc-800" />
            {[
              { n: "01", icon: Gift, title: "Créez un compte", desc: "Inscrivez-vous en 30 secondes. 10 coins offerts à l'inscription + 1 serveur d'essai gratuit 24H." },
              { n: "02", icon: Coins, title: "Rechargez vos coins", desc: "Achetez des coins avec Orange Money, Wave ou tout autre moyen de paiement mobile. À partir de 500 FCFA." },
              { n: "03", icon: Zap, title: "Créez votre serveur", desc: "Choisissez votre type de serveur, nommez-le. Il est en ligne en moins d'une minute avec un sous-domaine gratuit." },
            ].map(({ n, icon: Icon, title, desc }, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="relative flex flex-col items-center text-center p-8 rounded-2xl border border-zinc-800 bg-zinc-900/50"
              >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: ACCENT, color: "#09090B" }}>{n}</div>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mt-4"
                  style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}25` }}>
                  <Icon className="w-7 h-7" style={{ color: ACCENT }} />
                </div>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-zinc-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Essai gratuit CTA ────────────────────────────── */}
      <section className="relative z-10 py-16 px-4">
        <motion.div
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="max-w-3xl mx-auto rounded-3xl border p-10 text-center"
          style={{ borderColor: `${ACCENT}30`, background: `linear-gradient(135deg, ${ACCENT}0A 0%, transparent 100%)` }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl"
            style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}30` }}>🎁</div>
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Essayez sans risque — 24H gratuit</h2>
          <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
            Chaque nouveau compte reçoit un serveur Node.js gratuit pendant 24 heures.
            Aucune carte bancaire requise. Aucun engagement.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register">
              <Button className="rounded-full h-12 px-8 font-bold text-base gap-2"
                style={{ background: ACCENT, color: "#09090B" }}>
                <Gift className="w-5 h-5" /> Activer mon essai gratuit
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-zinc-500">
            {["Aucune carte requise", "Supprimé automatiquement", "Serveur Node.js complet"].map((t, i) => (
              <span key={i} className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {t}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="relative z-10 py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Tout inclus</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Une plateforme complète</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">Tout ce dont vous avez besoin pour héberger vos projets, sans configuration complexe.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Zap, title: "Déploiement instantané", desc: "Votre serveur est en ligne en moins d'une minute. Glissez votre code ZIP ou connectez GitHub." },
              { icon: Globe, title: "Sous-domaine gratuit", desc: "Chaque serveur reçoit automatiquement un sous-domaine `votre-app.flihost.site` avec SSL." },
              { icon: Shield, title: "Protection DDoS", desc: "Cloudflare protège vos serveurs des attaques DDoS. Votre IP reste cachée." },
              { icon: Terminal, title: "Console temps réel", desc: "Accédez à la console de votre serveur directement depuis le navigateur, sans SSH." },
              { icon: Activity, title: "Monitoring intégré", desc: "Visualisez la consommation CPU et RAM de vos serveurs en temps réel." },
              { icon: Clock, title: "Redémarrages planifiés", desc: "Programmez des redémarrages automatiques pour garder vos serveurs frais." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i % 3}
                className="p-7 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}20` }}>
                  <Icon className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <h3 className="text-base font-bold mb-2">{title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Types de serveurs ────────────────────────────── */}
      <section className="relative z-10 py-20 border-t border-zinc-900 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Polyvalent</p>
            <h2 className="text-3xl md:text-4xl font-bold">Tout type de serveur</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[
              { emoji: "🟢", name: "Node.js", price: "50 coins/mois" },
              { emoji: "🐍", name: "Python", price: "50 coins/mois" },
              { emoji: "🐘", name: "PHP", price: "50 coins/mois" },
              { emoji: "☕", name: "Java", price: "75 coins/mois" },
              { emoji: "⛏️", name: "Minecraft", price: "100 coins/mois" },
              { emoji: "🎮", name: "CS:GO", price: "150 coins/mois" },
              { emoji: "🔫", name: "Garry's Mod", price: "100 coins/mois" },
              { emoji: "🎙️", name: "TeamSpeak 3", price: "30 coins/mois" },
            ].map(({ emoji, name, price }, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i % 4 * 0.5}
                className="flex flex-col items-center p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 hover:border-zinc-600 transition-colors text-center"
              >
                <span className="text-3xl mb-3">{emoji}</span>
                <p className="font-bold text-sm mb-1">{name}</p>
                <p className="text-xs text-zinc-500">{price}</p>
              </motion.div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing">
              <Button variant="outline" className="border-zinc-800 hover:bg-zinc-800 gap-2">
                Voir tous les tarifs <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 text-center">
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <h2 className="text-3xl md:text-5xl font-bold mb-5">
            Prêt à déployer votre premier serveur ?
          </h2>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">
            Rejoignez 79+ développeurs qui font confiance à FlyHost pour héberger leurs projets.
          </p>
          <Link href="/register">
            <Button size="lg" className="rounded-full h-13 px-10 text-base font-bold gap-2"
              style={{ background: ACCENT, color: "#09090B" }}>
              Créer mon compte gratuit <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="relative z-10 py-10 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: ACCENT }}>
              <Triangle className="w-4 h-4 fill-black text-black" />
            </div>
            <span className="font-bold">FlyHost</span>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-zinc-500">
            <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Documentation</Link>
            <Link href="/status" className="hover:text-white transition-colors">Statut</Link>
            <Link href="/login" className="hover:text-white transition-colors">Connexion</Link>
            <Link href="/register" className="hover:text-white transition-colors">Inscription</Link>
          </nav>
          <p className="text-xs text-zinc-600">© 2026 FlyHost. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
