import { Link } from "wouter";
import { Triangle, Home, BookOpen, Server, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-yellow-400/3 blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-yellow-400/2 blur-[100px]" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center text-center max-w-md"
      >
        <Link href="/" className="flex items-center gap-2 mb-10 group">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-yellow-400 group-hover:scale-105 transition-transform">
            <Triangle className="w-5 h-5 fill-black text-black" />
          </div>
          <span className="font-bold text-xl text-white">FlyHost</span>
        </Link>

        <div className="text-[120px] font-black leading-none text-transparent bg-clip-text bg-gradient-to-b from-zinc-400 to-zinc-800 select-none mb-6">
          404
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Page introuvable</h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          Cette page n'existe pas ou a été déplacée. Voici quelques liens utiles pour vous aider.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mb-8">
          {[
            { href: "/dashboard", icon: Home, label: "Dashboard" },
            { href: "/servers", icon: Server, label: "Mes serveurs" },
            { href: "/docs", icon: BookOpen, label: "Documentation" },
          ].map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href}>
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900 transition-all cursor-pointer group">
                <Icon className="w-5 h-5 text-zinc-500 group-hover:text-yellow-400 transition-colors" />
                <span className="text-sm text-zinc-400 group-hover:text-white transition-colors">{label}</span>
              </div>
            </Link>
          ))}
        </div>

        <Link href="/">
          <Button variant="outline" className="border-zinc-800 hover:border-zinc-600 gap-2 text-zinc-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
