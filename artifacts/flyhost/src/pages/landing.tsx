import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Triangle, Zap, Shield, Globe, Terminal, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-hidden relative">
      {/* Decorative background image */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none select-none">
        <img 
          src={`${import.meta.env.BASE_URL}images/hero-glow.png`} 
          alt="Hero background" 
          className="w-full h-[80vh] object-cover mix-blend-screen"
        />
      </div>
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>

      {/* Nav */}
      <header className="relative z-10 w-full px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Triangle className="w-8 h-8 fill-white text-white" />
          <span className="font-display font-bold text-2xl tracking-tight">FlyHost</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">
            Login
          </Link>
          <Link href="/register">
            <Button className="rounded-full bg-white text-black hover:bg-gray-200 font-medium px-6">
              Sign Up
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-4 text-center mt-20 mb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-display font-bold tracking-tighter leading-[1.1] mb-8">
            Develop. <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-600">Preview.</span> Ship.
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            FlyHost is the frontend cloud for the modern web. Build and deploy fast, scalable applications without the configuration overhead.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="rounded-full h-14 px-8 text-base bg-white text-black hover:bg-gray-200 font-semibold w-full sm:w-auto shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                Start Deploying <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="rounded-full h-14 px-8 text-base border-border bg-black/50 hover:bg-white/5 backdrop-blur-sm w-full sm:w-auto">
              Read Documentation
            </Button>
          </div>
        </motion.div>
      </main>

      {/* Features */}
      <section className="relative z-10 py-24 bg-black/80 border-t border-border/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Everything you need to ship faster</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">An end-to-end platform for the modern developer.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Instant Deployments", desc: "Push to Git and your changes are live automatically. Zero configuration required." },
              { icon: Globe, title: "Global Edge Network", desc: "Your app is served from locations close to your users for sub-50ms latency." },
              { icon: Shield, title: "Built-in Security", desc: "DDoS protection, automatic SSL, and secure environment variables out of the box." },
              { icon: Terminal, title: "CLI & API", desc: "Integrate FlyHost into any workflow with our powerful CLI and REST API." },
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="gradient-border rounded-2xl p-8 bg-card/50 hover:bg-card/80 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-border bg-black text-center text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-6 opacity-50">
          <Triangle className="w-5 h-5 fill-current" />
          <span className="font-display font-bold tracking-widest">FLYHOST</span>
        </div>
        <p className="text-sm">© 2025 FlyHost Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
