import { useState, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Play, RefreshCw, Copy, Code2, Eye, Columns2, Sparkles, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const GIFTED_KEY = "gifted-api_0u5a705yfobo870e70ge6";
async function askCodeAI(prompt: string): Promise<string> {
  try {
    const r = await fetch(`/api/ai/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt }),
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) { const d = await r.json(); if (d.reply) return d.reply; }
  } catch {}
  for (const model of ["gpt4o", "gemini"]) {
    try {
      const r = await fetch(`https://api.giftedtech.co.ke/api/ai/${model}?apikey=${GIFTED_KEY}&q=${encodeURIComponent(prompt)}`, { signal: AbortSignal.timeout(20000) });
      if (r.ok) { const d = await r.json(); if (d.result) return String(d.result); }
    } catch {}
  }
  throw new Error("FlyBot indisponible.");
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ma page</title>
</head>
<body>
  <div class="container">
    <h1>Bonjour FlyHost 👋</h1>
    <p>Modifiez le code HTML, CSS et JS pour voir le résultat en direct.</p>
    <button onclick="alert('Ça marche !')">Cliquez-moi</button>
  </div>
</body>
</html>`;

const DEFAULT_CSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: #09090B;
  color: #FAFAFA;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
}

.container {
  max-width: 600px;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  font-weight: 800;
  color: #FACC15;
  margin-bottom: 16px;
}

p {
  color: #A1A1AA;
  font-size: 1.1rem;
  margin-bottom: 24px;
  line-height: 1.6;
}

button {
  background: #FACC15;
  color: #09090B;
  border: none;
  padding: 12px 28px;
  font-size: 1rem;
  font-weight: 700;
  border-radius: 10px;
  cursor: pointer;
  transition: opacity 0.2s;
}

button:hover {
  opacity: 0.85;
}`;

const DEFAULT_JS = `// Votre JavaScript ici
console.log('Page chargée !');

// Exemple : animation au clic
document.querySelector('button')?.addEventListener('click', () => {
  document.querySelector('h1').style.color = 
    '#' + Math.floor(Math.random()*16777215).toString(16);
});`;

type EditorTab = "html" | "css" | "js";
type ViewMode = "editor" | "preview" | "split";

function buildSrcDoc(html: string, css: string, js: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const head = doc.head;
  const body = doc.body;

  const styleEl = doc.createElement("style");
  styleEl.textContent = css;
  head.appendChild(styleEl);

  const scriptEl = doc.createElement("script");
  scriptEl.textContent = js;
  body.appendChild(scriptEl);

  return doc.documentElement.outerHTML;
}

export default function EditorPage() {
  const [htmlCode, setHtmlCode] = useState(DEFAULT_HTML);
  const [cssCode, setCssCode] = useState(DEFAULT_CSS);
  const [jsCode, setJsCode] = useState(DEFAULT_JS);
  const [activeTab, setActiveTab] = useState<EditorTab>("html");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [previewKey, setPreviewKey] = useState(0);
  const [livePreview, setLivePreview] = useState(true);
  const [cachedSrcDoc, setCachedSrcDoc] = useState(() => buildSrcDoc(DEFAULT_HTML, DEFAULT_CSS, DEFAULT_JS));
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const [aiPanel, setAiPanel] = useState<{ open: boolean; result: string | null; loading: boolean; action: string }>({ open: false, result: null, loading: false, action: "" });

  async function runAiAction(action: "explain" | "fix" | "improve") {
    const code = activeTab === "html" ? htmlCode : activeTab === "css" ? cssCode : jsCode;
    const lang = activeTab.toUpperCase();
    const labels: Record<string, string> = { explain: "Expliquer", fix: "Corriger", improve: "Améliorer" };
    const prompts: Record<string, string> = {
      explain: `Tu es FlyBot, assistant IA FlyHost. Explique ce code ${lang} de façon simple et pédagogique (pour un débutant). Explique ce qu'il fait, section par section. Réponds en français.\n\nCode:\n\`\`\`${lang.toLowerCase()}\n${code.slice(0, 3000)}\n\`\`\``,
      fix: `Tu es FlyBot, assistant IA FlyHost. Identifie et corrige les bugs et erreurs dans ce code ${lang}. Montre le code corrigé avec des explications. Réponds en français.\n\nCode:\n\`\`\`${lang.toLowerCase()}\n${code.slice(0, 3000)}\n\`\`\``,
      improve: `Tu es FlyBot, assistant IA FlyHost. Propose des améliorations concrètes pour ce code ${lang}: performance, lisibilité, bonnes pratiques. Réponds en français avec des exemples.\n\nCode:\n\`\`\`${lang.toLowerCase()}\n${code.slice(0, 3000)}\n\`\`\``,
    };
    setAiPanel({ open: true, result: null, loading: true, action: labels[action] });
    try {
      const reply = await askCodeAI(prompts[action]);
      setAiPanel(p => ({ ...p, result: reply, loading: false }));
    } catch (e: any) {
      setAiPanel(p => ({ ...p, result: "FlyBot temporairement indisponible.", loading: false }));
    }
  }

  const liveSrcDoc = buildSrcDoc(htmlCode, cssCode, jsCode);
  const srcDoc = livePreview ? liveSrcDoc : cachedSrcDoc;

  const handleRefresh = useCallback(() => {
    setCachedSrcDoc(buildSrcDoc(htmlCode, cssCode, jsCode));
    setPreviewKey(k => k + 1);
  }, [htmlCode, cssCode, jsCode]);

  const handleDownload = () => {
    const blob = new Blob([srcDoc], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "page.html";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Fichier téléchargé", description: "page.html a été enregistré." });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(srcDoc);
    toast({ title: "Copié !", description: "Le HTML complet a été copié dans le presse-papiers." });
  };

  const getEditorValue = () => {
    if (activeTab === "html") return htmlCode;
    if (activeTab === "css") return cssCode;
    return jsCode;
  };

  const handleEditorChange = (value: string | undefined) => {
    const v = value ?? "";
    if (activeTab === "html") setHtmlCode(v);
    else if (activeTab === "css") setCssCode(v);
    else setJsCode(v);
  };

  const tabColor = {
    html: "text-orange-400",
    css: "text-blue-400",
    js: "text-yellow-400",
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-full -mt-2">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2 border-b border-border bg-card/50 backdrop-blur shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-yellow-400 shrink-0" />
            <h1 className="text-base font-bold text-white hidden sm:block">Éditeur HTML</h1>

            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setViewMode("editor")}
                title="Éditeur seul"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "editor" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                )}
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("split")}
                title="Côte à côte"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "split" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                )}
              >
                <Columns2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("preview")}
                title="Preview seule"
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  viewMode === "preview" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"
                )}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLivePreview(v => !v)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors",
                livePreview
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-border text-muted-foreground hover:text-white"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", livePreview ? "bg-emerald-400 animate-pulse" : "bg-zinc-500")} />
              Live
            </button>
            <Button size="sm" variant="ghost" onClick={handleRefresh} className="text-muted-foreground hover:text-white h-8 px-2">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCopy} className="text-muted-foreground hover:text-white h-8 px-2">
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline ml-1.5 text-xs">Copier</span>
            </Button>
            <Button size="sm" onClick={handleDownload} className="bg-yellow-400 text-black hover:bg-yellow-300 h-8 px-3 text-xs font-bold">
              <Download className="w-3.5 h-3.5 mr-1" />
              .html
            </Button>

            <div className="h-5 w-px bg-border mx-1" />

            {/* AI Buttons */}
            <Button size="sm" variant="ghost" onClick={() => runAiAction("explain")} disabled={aiPanel.loading} className="h-8 px-2.5 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10" title="Expliquer ce code">
              {aiPanel.loading && aiPanel.action === "Expliquer" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span className="hidden md:inline ml-1">Expliquer</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => runAiAction("fix")} disabled={aiPanel.loading} className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10" title="Corriger les bugs">
              <span className="text-xs">🐛</span>
              <span className="hidden md:inline ml-1">Corriger</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => runAiAction("improve")} disabled={aiPanel.loading} className="h-8 px-2.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10" title="Améliorer le code">
              <span className="text-xs">⬆</span>
              <span className="hidden md:inline ml-1">Améliorer</span>
            </Button>
          </div>
        </div>

        {/* AI Panel (full-width, below toolbar) */}
        {aiPanel.open && (
          <div className="shrink-0 border-b border-yellow-400/20 bg-yellow-400/5">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-yellow-400/10">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-xs font-semibold text-yellow-400">FlyBot — {aiPanel.action} ({activeTab.toUpperCase()})</span>
              <button onClick={() => setAiPanel(p => ({ ...p, open: false, result: null }))} className="ml-auto text-muted-foreground hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-4 py-3 text-xs text-gray-300 leading-relaxed font-mono max-h-48 overflow-y-auto whitespace-pre-wrap">
              {aiPanel.loading ? (
                <span className="flex items-center gap-2 text-yellow-400/70"><Loader2 className="w-3 h-3 animate-spin" /> FlyBot analyse votre code...</span>
              ) : (
                aiPanel.result
              )}
            </div>
          </div>
        )}

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Editor panel */}
          {viewMode !== "preview" && (
            <div className={cn("flex flex-col overflow-hidden", viewMode === "split" ? "w-1/2 border-r border-border" : "w-full")}>
              {/* Tab bar */}
              <div className="flex items-center gap-0 border-b border-border bg-[#0d0d0d] shrink-0">
                {(["html", "css", "js"] as EditorTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors border-b-2",
                      activeTab === tab
                        ? `${tabColor[tab]} border-current bg-[#09090B]`
                        : "text-muted-foreground border-transparent hover:text-white"
                    )}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Monaco editor */}
              <div className="flex-1 overflow-hidden">
                <Editor
                  height="100%"
                  language={activeTab === "js" ? "javascript" : activeTab}
                  value={getEditorValue()}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontLigatures: true,
                    lineNumbers: "on",
                    wordWrap: "on",
                    scrollBeyondLastLine: false,
                    tabSize: 2,
                    padding: { top: 12 },
                    renderLineHighlight: "line",
                    smoothScrolling: true,
                    cursorBlinking: "smooth",
                  }}
                />
              </div>
            </div>
          )}

          {/* Preview panel */}
          {viewMode !== "editor" && (
            <div className={cn("flex flex-col overflow-hidden bg-white", viewMode === "split" ? "w-1/2" : "w-full")}>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1a] border-b border-border shrink-0">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-yellow-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xs text-zinc-500 ml-1">preview</span>
                {!livePreview && (
                  <button
                    onClick={handleRefresh}
                    className="ml-auto flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300"
                  >
                    <Play className="w-3 h-3" /> Actualiser
                  </button>
                )}
              </div>
              <iframe
                key={livePreview ? undefined : previewKey}
                ref={iframeRef}
                srcDoc={srcDoc}
                title="preview"
                className="flex-1 w-full border-0"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
