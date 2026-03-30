import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Minimize2, Maximize2, Sparkles, LogsIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  "Comment déployer une app Node.js ?",
  "Comment configurer un nom de domaine ?",
  "Quels plans d'hébergement existent ?",
  "Comment payer en Mobile Money ?",
];

const GIFTED_KEY = "gifted-api_0u5a705yfobo870e70ge6";
const GIFTED_BASE = "https://api.giftedtech.co.ke/api/ai";
const FLYHOST_CONTEXT = "Tu es FlyBot, l'assistant IA de FlyHost — la plateforme d'hébergement web pour l'Afrique francophone. FlyHost déploie des apps Node.js, Python, PHP, Java et des serveurs Minecraft. Paiement en FCFA (Orange Money, Wave, MTN). Réponds en français, de façon claire et pratique.";

async function callGiftedAI(message: string): Promise<string> {
  const q = `${FLYHOST_CONTEXT}\n\nQuestion: ${message}`;
  for (const model of ["gpt4o", "gemini", "ai"]) {
    try {
      const r = await fetch(`${GIFTED_BASE}/${model}?apikey=${GIFTED_KEY}&q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.result) return String(d.result);
      }
    } catch {}
  }
  throw new Error("L'IA est temporairement indisponible, réessaie dans un instant.");
}

async function sendChat(message: string): Promise<string> {
  // Try backend API first (works when proxy/API is updated)
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reply) return data.reply as string;
    }
    if (res.status === 401) throw new Error("Non authentifié");
    if (res.status === 400) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || "Requête invalide");
    }
    // 404/503 → fallback to direct GiftedTech call
  } catch (e: any) {
    if (e.message === "Non authentifié" || e.message === "Requête invalide") throw e;
    // Timeout or network error → try direct
  }
  return callGiftedAI(message);
}

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Bonjour ! Je suis **FlyBot**, votre assistant IA FlyHost 🚀\n\nJe peux vous aider avec le déploiement, la configuration, les paiements et tout ce qui concerne FlyHost. Comment puis-je vous aider ?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const reply = await sendChat(msg);
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ ${e.message || "Une erreur est survenue. Réessaie dans un instant."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  function renderContent(content: string) {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code class=\"bg-zinc-800 px-1 py-0.5 rounded text-yellow-300 text-xs\">$1</code>")
      .replace(/\n/g, "<br/>");
  }

  return (
    <>
      {/* Bouton flottant IA */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 sm:bottom-20 sm:right-6 z-50 flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-yellow-400/30 bg-gradient-to-br from-zinc-900 to-zinc-800 border border-yellow-400/30 text-yellow-400"
          title="FlyBot - Assistant IA"
        >
          <Sparkles className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold hidden sm:inline">FlyBot IA</span>
        </button>
      )}

      {/* Fenêtre de chat */}
      {open && (
        <div
          className={cn(
            "fixed right-4 sm:right-6 z-50 flex flex-col bg-zinc-900 border border-yellow-400/20 rounded-2xl shadow-2xl shadow-black/50 transition-all duration-300",
            minimized
              ? "bottom-4 sm:bottom-6 w-64 h-auto"
              : "bottom-4 sm:bottom-6 w-80 sm:w-96 h-[520px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-yellow-400/15 rounded-t-2xl bg-gradient-to-r from-zinc-900 to-zinc-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-400/15 border border-yellow-400/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">FlyBot</p>
                <p className="text-xs text-zinc-500">Assistant IA FlyHost</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimized((m) => !m)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-md bg-yellow-400/15 border border-yellow-400/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3 h-3 text-yellow-400" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[78%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                        msg.role === "user"
                          ? "bg-yellow-400 text-black font-medium rounded-br-none"
                          : "bg-zinc-800 text-zinc-200 rounded-bl-none border border-zinc-700/50"
                      )}
                      dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
                    />
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-6 h-6 rounded-md bg-yellow-400/15 border border-yellow-400/25 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3 h-3 text-yellow-400" />
                    </div>
                    <div className="bg-zinc-800 border border-zinc-700/50 rounded-xl rounded-bl-none px-3 py-2">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Questions rapides (seulement sur le message de bienvenue) */}
              {messages.length === 1 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1.5">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/60 text-zinc-300 hover:border-yellow-400/40 hover:text-yellow-300 transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Zone de saisie */}
              <div className="p-3 border-t border-yellow-400/10 flex-shrink-0">
                <div className="flex gap-2 items-end bg-zinc-800 border border-zinc-700/60 rounded-xl p-2 focus-within:border-yellow-400/40 transition-colors">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pose ta question à FlyBot..."
                    rows={1}
                    className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-500 resize-none outline-none leading-relaxed max-h-20"
                    disabled={loading}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    className="p-1.5 rounded-lg bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600 mt-1 text-center">IA propulsée par GPT-4o · FlyHost</p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
