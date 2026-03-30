import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Mail, Users, User, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Template = "promo" | "announcement" | "ad" | "custom";
type Target = "all" | "email";


const TEMPLATES = [
  {
    id: "promo" as Template,
    label: "Promotion",
    emoji: "🎉",
    color: "border-yellow-500/30 bg-yellow-500/5",
    badge: "bg-yellow-500/20 text-yellow-400",
    desc: "Offre spéciale, réduction, bonus coins",
    hasCta: true,
  },
  {
    id: "announcement" as Template,
    label: "Annonce",
    emoji: "📢",
    color: "border-blue-500/30 bg-blue-500/5",
    badge: "bg-blue-500/20 text-blue-400",
    desc: "Nouvelle fonctionnalité, mise à jour plateforme",
    hasCta: false,
  },
  {
    id: "ad" as Template,
    label: "Publicité",
    emoji: "✨",
    color: "border-purple-500/30 bg-purple-500/5",
    badge: "bg-purple-500/20 text-purple-400",
    desc: "Service partenaire, offre commerciale",
    hasCta: true,
  },
  {
    id: "custom" as Template,
    label: "Personnalisé",
    emoji: "✉️",
    color: "border-zinc-600/30 bg-zinc-800/30",
    badge: "bg-zinc-700/50 text-zinc-400",
    desc: "Message libre entièrement personnalisé",
    hasCta: false,
  },
];

export function CampaignsTab() {
  const { toast } = useToast();

  const [template, setTemplate] = useState<Template>("announcement");
  const [target, setTarget] = useState<Target>("all");
  const [targetEmail, setTargetEmail] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Découvrir");
  const [ctaUrl, setCtaUrl] = useState("https://flihost.site");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const selectedTpl = TEMPLATES.find(t => t.id === template)!;

  async function handleSend() {
    if (!body.trim()) {
      toast({ variant: "destructive", title: "Corps du message requis", description: "Veuillez saisir le contenu de l'email." });
      return;
    }
    if (template !== "custom" && !title.trim()) {
      toast({ variant: "destructive", title: "Titre requis", description: "Veuillez saisir un titre pour la campagne." });
      return;
    }
    if (target === "email" && !targetEmail.trim()) {
      toast({ variant: "destructive", title: "Email requis", description: "Veuillez saisir l'email du destinataire." });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const token = localStorage.getItem("flyhost_token");
      const res = await fetch(`/api/admin/campaigns/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ template, target, email: targetEmail, title, body, subject, ctaLabel, ctaUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'envoi");

      setResult({ sent: data.sent, failed: data.failed, total: data.total });
      toast({
        title: "Campagne envoyée !",
        description: `${data.sent}/${data.total} emails envoyés avec succès.`,
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
          <Mail className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Campagnes email</h2>
          <p className="text-sm text-zinc-500">Envoyez des emails à vos utilisateurs avec des templates prêts à l'emploi</p>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">Campagne envoyée !</p>
            <p className="text-xs text-zinc-400">{result.sent} emails envoyés · {result.failed} échecs · {result.total} destinataires</p>
          </div>
          <button onClick={() => setResult(null)} className="ml-auto text-zinc-600 hover:text-zinc-300 text-xs">Fermer</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column — template + target */}
        <div className="space-y-5">
          {/* Template selector */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm font-semibold">Type de campagne</Label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplate(tpl.id)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    template === tpl.id ? tpl.color + " border-opacity-100" : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700"
                  )}
                >
                  <div className="text-xl mb-1">{tpl.emoji}</div>
                  <p className="text-sm font-semibold text-white">{tpl.label}</p>
                  <p className="text-xs text-zinc-500 leading-tight mt-0.5">{tpl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Target */}
          <div className="space-y-2">
            <Label className="text-zinc-300 text-sm font-semibold">Destinataires</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTarget("all")}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border transition-all",
                  target === "all" ? "border-yellow-500/40 bg-yellow-500/8 text-yellow-400" : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700"
                )}
              >
                <Users className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Tous les utilisateurs</p>
                  <p className="text-xs opacity-70">Emails vérifiés</p>
                </div>
              </button>
              <button
                onClick={() => setTarget("email")}
                className={cn(
                  "flex items-center gap-2.5 p-3 rounded-xl border transition-all",
                  target === "email" ? "border-yellow-500/40 bg-yellow-500/8 text-yellow-400" : "border-zinc-800 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700"
                )}
              >
                <User className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold">Utilisateur ciblé</p>
                  <p className="text-xs opacity-70">Par adresse email</p>
                </div>
              </button>
            </div>

            {target === "email" && (
              <Input
                placeholder="utilisateur@email.com"
                value={targetEmail}
                onChange={e => setTargetEmail(e.target.value)}
                className="bg-zinc-900/50 border-zinc-700 text-white"
              />
            )}
          </div>
        </div>

        {/* Right column — content */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold", selectedTpl.badge)}>
              {selectedTpl.emoji} {selectedTpl.label}
            </span>
            <span className="text-xs text-zinc-600">Contenu de l'email</span>
          </div>

          {template === "custom" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">Objet de l'email</Label>
                <Input
                  placeholder="Ex: Message important de FlyHost"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">Corps du message</Label>
                <Textarea
                  placeholder="Votre message ici..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={8}
                  className="bg-zinc-900/50 border-zinc-700 text-white resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">Titre / Accroche</Label>
                <Input
                  placeholder={template === "promo" ? "Ex: -30% sur tous les plans ce weekend !" : template === "announcement" ? "Ex: Nouvelle fonctionnalité disponible" : "Ex: Offre exclusive partenaire"}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="bg-zinc-900/50 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs">Corps du message</Label>
                <Textarea
                  placeholder="Décrivez votre offre, annonce ou publicité ici..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={5}
                  className="bg-zinc-900/50 border-zinc-700 text-white resize-none"
                />
              </div>
              {selectedTpl.hasCta && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-xs">Texte du bouton</Label>
                    <Input
                      placeholder="Découvrir"
                      value={ctaLabel}
                      onChange={e => setCtaLabel(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-400 text-xs">URL du bouton</Label>
                    <Input
                      placeholder="https://flihost.site/..."
                      value={ctaUrl}
                      onChange={e => setCtaUrl(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-700 text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={sending}
            className="w-full bg-yellow-400 text-black hover:bg-yellow-300 font-bold mt-2"
          >
            {sending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi en cours...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Envoyer la campagne{target === "all" ? " à tous" : ""}</>
            )}
          </Button>

          <p className="text-xs text-zinc-600 text-center">
            {target === "all"
              ? "L'email sera envoyé à tous les utilisateurs avec un email vérifié"
              : targetEmail
              ? `L'email sera envoyé uniquement à ${targetEmail}`
              : "Sélectionnez un destinataire ciblé"}
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        {[
          { icon: "🎯", title: "Taux d'ouverture", desc: "Utilisez des titres accrocheurs et personnels" },
          { icon: "⏰", title: "Meilleur moment", desc: "Mardi–jeudi, 9h–11h ou 14h–16h (WAT)" },
          { icon: "📊", title: "Fréquence", desc: "Max 1–2 emails par semaine pour éviter le spam" },
        ].map(tip => (
          <div key={tip.title} className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-4">
            <div className="text-xl mb-2">{tip.icon}</div>
            <p className="text-sm font-semibold text-white mb-1">{tip.title}</p>
            <p className="text-xs text-zinc-600">{tip.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
