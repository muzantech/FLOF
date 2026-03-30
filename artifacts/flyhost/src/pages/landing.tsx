import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Triangle, Zap, Shield, Globe, Terminal, ArrowRight,
  Coins, Gift, Activity, Server, CheckCircle2, Users,
  Clock, Star, ChevronRight, X, Check, HelpCircle, MapPin
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";

const ACCENT = "#FACC15";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: i * 0.08, ease: "easeOut" } }),
};

const FAQS = [
  {
    q: "Ai-je besoin d'une carte bancaire pour m'inscrire ?",
    a: "Non. Aucune carte bancaire n'est requise. Vous recevez 10 coins gratuitement à l'inscription et un serveur d'essai 24H. Pour recharger, utilisez Orange Money, Wave, MTN ou tout autre Mobile Money disponible dans votre pays."
  },
  {
    q: "Dans quels pays FlyHost est-il disponible ?",
    a: "FlyHost est disponible partout, mais les paiements Mobile Money sont optimisés pour le Cameroun, la Côte d'Ivoire, le Sénégal, le Mali, le Burkina Faso, la Guinée et les pays utilisant le franc CFA (XOF/XAF)."
  },
  {
    q: "Quelle est la différence entre FlyHost et Vercel ou Render ?",
    a: "Vercel et Render ne proposent que des paiements en USD par carte bancaire, ce qui est difficile d'accès en Afrique. FlyHost facture en FCFA et accepte le Mobile Money. De plus, nos tarifs sont adaptés au pouvoir d'achat africain — à partir de 500 FCFA."
  },
  {
    q: "Mon serveur reste-t-il en ligne 24h/24 ?",
    a: "Oui, contrairement à certains hébergeurs gratuits qui éteignent les serveurs inactifs. Tant que vous avez des coins sur votre compte, votre serveur tourne en continu."
  },
  {
    q: "Puis-je déployer depuis GitHub ?",
    a: "Oui. Vous pouvez déployer via GitHub ou en uploadant un fichier ZIP directement depuis l'interface. Les deux méthodes sont supportées pour Node.js, Python, PHP, Java et plus."
  },
  {
    q: "Que se passe-t-il si mes coins sont épuisés ?",
    a: "Vous recevrez un email d'alerte avant que vos coins ne s'épuisent. Si le solde tombe à zéro, le serveur est suspendu (pas supprimé). Rechargez vos coins pour le remettre en ligne immédiatement."
  },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
      <header className="relative z-10 w-full px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT }}>
            <Triangle className="w-5 h-5 fill-black text-black" />
          </div>
          <span className="font-bold text-xl tracking-tight">FlyHost</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <Link href="/status" className="hover:text-white transition-colors">Statut</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors hidden sm:block">
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
          L'hébergement web{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
            fait pour l'Afrique.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp} initial="hidden" animate="visible" custom={2}
          className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light"
        >
          Déployez Node.js, Python, PHP ou Java en quelques secondes.
          Payez en <strong className="text-white">FCFA</strong> avec Orange Money, Wave ou MTN — sans carte Visa ni compte étranger.
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
              Voir les tarifs en FCFA
            </Button>
          </Link>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          variants={fadeUp} initial="hidden" animate="visible" custom={4}
          className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-zinc-500"
        >
          {[
            { icon: Users, text: "87+ développeurs actifs" },
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

      {/* ── Fait pour l'Afrique ───────────────────────────── */}
      <section className="relative z-10 py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Conçu pour vous</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Pensé pour l'Afrique francophone</h2>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Vercel et Render ne fonctionnent qu'avec des cartes bancaires en USD. FlyHost, c'est différent.
            </p>
          </div>

          {/* Pays */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {[
              { flag: "🇨🇲", name: "Cameroun" },
              { flag: "🇨🇮", name: "Côte d'Ivoire" },
              { flag: "🇸🇳", name: "Sénégal" },
              { flag: "🇲🇱", name: "Mali" },
              { flag: "🇧🇫", name: "Burkina Faso" },
              { flag: "🇬🇳", name: "Guinée" },
              { flag: "🇹🇬", name: "Togo" },
              { flag: "🇧🇯", name: "Bénin" },
              { flag: "🇳🇪", name: "Niger" },
              { flag: "🌍", name: "Et plus..." },
            ].map(({ flag, name }) => (
              <div key={name} className="flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/40 text-sm">
                <span className="text-lg">{flag}</span>
                <span className="text-zinc-300">{name}</span>
              </div>
            ))}
          </div>

          {/* Avantages clés */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                emoji: "📱",
                title: "Orange Money & Wave",
                desc: "Rechargez vos coins directement avec votre téléphone. Pas besoin de carte Visa, pas de compte PayPal, pas de compte étranger."
              },
              {
                emoji: "🪙",
                title: "Prix en FCFA",
                desc: "À partir de 500 FCFA pour 100 coins. Pas de surprise de change, pas de frais cachés en USD. Ce que vous voyez, c'est ce que vous payez."
              },
              {
                emoji: "⚡",
                title: "Sans engagement",
                desc: "Payez uniquement ce que vous utilisez. Arrêtez quand vous voulez. Votre serveur ne dort jamais tant que votre solde est positif."
              },
            ].map(({ emoji, title, desc }, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i}
                className="p-7 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center"
              >
                <div className="text-4xl mb-4">{emoji}</div>
                <h3 className="text-base font-bold mb-2">{title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ────────────────────────────── */}
      <section className="relative z-10 py-20 border-t border-zinc-900 bg-zinc-950/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Simple par conception</p>
            <h2 className="text-3xl md:text-4xl font-bold">Déployé en 3 étapes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[33%] right-[33%] h-px bg-gradient-to-r from-zinc-800 via-yellow-400/30 to-zinc-800" />
            {[
              { n: "01", icon: Gift, title: "Créez un compte", desc: "Inscrivez-vous en 30 secondes. 10 coins offerts à l'inscription + 1 serveur d'essai gratuit 24H." },
              { n: "02", icon: Coins, title: "Rechargez en FCFA", desc: "Achetez des coins avec Orange Money, Wave ou MTN Mobile Money. À partir de 500 FCFA, sans carte bancaire." },
              { n: "03", icon: Zap, title: "Votre app en ligne", desc: "Choisissez votre runtime, uploadez votre code (ZIP ou GitHub). En ligne en moins d'une minute avec sous-domaine SSL gratuit." },
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

      {/* ── Tarifs transparents ───────────────────────────── */}
      <section className="relative z-10 py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Tarifs clairs</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Prix en FCFA, sans surprise</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">Pas de conversion USD, pas de frais cachés. Tout est affiché en francs CFA.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Packs coins */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7">
              <h3 className="text-base font-bold mb-1 flex items-center gap-2">
                <Coins className="w-4 h-4" style={{ color: ACCENT }} /> Packs de coins
              </h3>
              <p className="text-xs text-zinc-500 mb-5">Rechargez avec Mobile Money</p>
              <div className="space-y-3">
                {[
                  { coins: 100, price: "500 FCFA", tag: "" },
                  { coins: 250, price: "1 100 FCFA", tag: "" },
                  { coins: 500, price: "2 000 FCFA", tag: "Populaire" },
                  { coins: 1000, price: "3 500 FCFA", tag: "" },
                  { coins: 2500, price: "8 000 FCFA", tag: "Meilleur prix" },
                ].map(({ coins, price, tag }) => (
                  <div key={coins} className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{coins} coins</span>
                      {tag && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${ACCENT}20`, color: ACCENT }}>{tag}</span>}
                    </div>
                    <span className="text-sm font-bold" style={{ color: ACCENT }}>{price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Types de serveurs */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-7">
              <h3 className="text-base font-bold mb-1 flex items-center gap-2">
                <Server className="w-4 h-4" style={{ color: ACCENT }} /> Types de serveurs
              </h3>
              <p className="text-xs text-zinc-500 mb-5">Coût mensuel en coins</p>
              <div className="space-y-3">
                {[
                  { emoji: "🟢", name: "Node.js / TypeScript", coins: "50 coins/mois" },
                  { emoji: "🐍", name: "Python", coins: "50 coins/mois" },
                  { emoji: "🐘", name: "PHP", coins: "50 coins/mois" },
                  { emoji: "☕", name: "Java", coins: "75 coins/mois" },
                  { emoji: "⛏️", name: "Minecraft", coins: "100 coins/mois" },
                  { emoji: "🎙️", name: "TeamSpeak 3", coins: "30 coins/mois" },
                ].map(({ emoji, name, coins }) => (
                  <div key={name} className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span>{emoji}</span>
                      <span className="text-sm text-zinc-300">{name}</span>
                    </div>
                    <span className="text-sm font-semibold text-zinc-400">{coins}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <Link href="/pricing">
              <Button variant="outline" className="border-zinc-700 hover:bg-zinc-800 gap-2 rounded-full">
                Voir tous les tarifs <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Comparaison ──────────────────────────────────── */}
      <section className="relative z-10 py-20 border-t border-zinc-900 bg-zinc-950/50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>Pourquoi FlyHost</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">FlyHost vs les alternatives</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">Vercel et Render sont excellents — mais pas faits pour l'Afrique.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-4 px-4 text-zinc-500 font-medium w-1/3">Fonctionnalité</th>
                  <th className="py-4 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-black text-xs" style={{ background: ACCENT }}>
                      <Triangle className="w-3 h-3 fill-black" /> FlyHost
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center text-zinc-400 font-medium">Render</th>
                  <th className="py-4 px-4 text-center text-zinc-400 font-medium">Vercel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {[
                  ["Paiement Mobile Money (Orange, Wave...)", true, false, false],
                  ["Facturation en FCFA", true, false, false],
                  ["Sans carte bancaire", true, false, false],
                  ["Serveur actif 24/7 (pas de sleep)", true, false, true],
                  ["Déploiement ZIP + GitHub", true, false, true],
                  ["Node.js, Python, PHP, Java", true, true, false],
                  ["Serveurs Minecraft / jeux", true, false, false],
                  ["Console serveur temps réel", true, false, false],
                  ["Sous-domaine SSL gratuit", true, true, true],
                  ["Plan gratuit disponible", true, true, true],
                ].map(([feature, flyhost, render, vercel], i) => (
                  <tr key={i} className="hover:bg-zinc-900/30 transition-colors">
                    <td className="py-3.5 px-4 text-zinc-300">{feature as string}</td>
                    <td className="py-3.5 px-4 text-center">
                      {flyhost ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : <X className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {render ? <Check className="w-4 h-4 text-zinc-400 mx-auto" /> : <X className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {vercel ? <Check className="w-4 h-4 text-zinc-400 mx-auto" /> : <X className="w-4 h-4 text-zinc-700 mx-auto" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ───────────────────────────────── */}
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
              { icon: Globe, title: "Sous-domaine SSL gratuit", desc: "Chaque serveur reçoit automatiquement un sous-domaine `votre-app.flihost.site` avec SSL." },
              { icon: Shield, title: "Protection DDoS Cloudflare", desc: "Cloudflare protège vos serveurs des attaques DDoS. Votre IP reste cachée." },
              { icon: Terminal, title: "Console temps réel", desc: "Accédez à la console de votre serveur directement depuis le navigateur, sans SSH." },
              { icon: Activity, title: "Monitoring CPU & RAM", desc: "Visualisez la consommation CPU et RAM de vos serveurs en temps réel." },
              { icon: Clock, title: "Redémarrages planifiés", desc: "Programmez des redémarrages automatiques pour garder vos serveurs performants." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i % 3}
                className="p-7 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors"
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

      {/* ── Essai gratuit CTA ────────────────────────────── */}
      <section className="relative z-10 py-16 px-4 border-t border-zinc-900">
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

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section id="faq" className="relative z-10 py-20 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: ACCENT }}>FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Questions fréquentes</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i * 0.5}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between p-5 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-sm pr-4">{faq.q}</span>
                  <HelpCircle className={`w-4 h-4 flex-shrink-0 transition-colors ${openFaq === i ? "text-yellow-400" : "text-zinc-600"}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-zinc-400 leading-relaxed border-t border-zinc-800 pt-4">
                    {faq.a}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-4 text-center border-t border-zinc-900">
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <div className="flex items-center justify-center gap-2 mb-6">
            <MapPin className="w-4 h-4" style={{ color: ACCENT }} />
            <span className="text-sm text-zinc-400">Fait pour l'Afrique. Utilisé dans 9+ pays.</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-5">
            Prêt à déployer votre premier serveur ?
          </h2>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">
            Rejoignez 87+ développeurs africains qui font confiance à FlyHost. Payez en FCFA, déployez en secondes.
          </p>
          <Link href="/register">
            <Button size="lg" className="rounded-full h-13 px-10 text-base font-bold gap-2"
              style={{ background: ACCENT, color: "#09090B" }}>
              Créer mon compte gratuit <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <p className="text-xs text-zinc-600 mt-4">Sans carte bancaire · Orange Money · Wave · MTN</p>
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
            <span className="text-xs text-zinc-600 ml-1">— Hébergement web Afrique</span>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm text-zinc-500">
            <Link href="/pricing" className="hover:text-white transition-colors">Tarifs</Link>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
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
