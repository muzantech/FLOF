import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Editor from "@monaco-editor/react";
import {
  Server,
  Terminal,
  FolderOpen,
  Settings,
  Play,
  Square,
  RotateCcw,
  Zap,
  Cpu,
  MemoryStick,
  HardDrive,
  ArrowLeft,
  Folder,
  FileText,
  File as FileIcon,
  ChevronRight,
  Trash2,
  Plus,
  Save,
  Upload,
  RefreshCw,
  ExternalLink,
  Home,
  X,
  Loader2,
  GitBranch,
  Code2,
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Skull,
} from "lucide-react";

// ── Types ─────────────────────────────────
interface ServerInfo {
  id: number;
  uuid: string;
  identifier: string;
  name: string;
  status: string | null;
  suspended: boolean;
  limits: { memory: number; disk: number; cpu: number };
  allocation?: { ip: string; port: number };
}

interface FileEntry {
  name: string;
  mode: string;
  mode_bits: string;
  size: number;
  is_file: boolean;
  is_symlink: boolean;
  mimetype: string;
  created_at: string;
  modified_at: string;
}

interface ConsoleLine {
  text: string;
  ts: number;
  type: "output" | "system" | "error";
}

// ── Helpers ───────────────────────────────
/**
 * Strip ALL ANSI/VT100 escape sequences from terminal output.
 * Handles: colors (SGR), cursor movement, line erase, screen erase,
 * OSC sequences (window title), and other ESC sequences.
 */
function stripAnsi(str: string): string {
  return str
    // CSI sequences: ESC [ ... (any final byte A-Z, a-z, @, ~)
    .replace(/\x1b\[[0-9;:<=>?]*[ -/]*[@-~]/g, "")
    // OSC sequences: ESC ] ... (terminated by BEL or ST)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
    // Single-char ESC sequences (ESC followed by a non-[ char)
    .replace(/\x1b[^[\]]/g, "")
    // Leftover bare ESC characters
    .replace(/\x1b/g, "")
    // C1 control chars (0x80-0x9F) — some terminals use these
    .replace(/[\x80-\x9f]/g, "")
    // Other non-printable control chars except \n, \r, \t
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtMb(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} Go` : `${mb} Mo`;
}

function getFileLanguage(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    js: "javascript", ts: "typescript", jsx: "javascript", tsx: "typescript",
    json: "json", yaml: "yaml", yml: "yaml", xml: "xml",
    html: "html", css: "css", scss: "scss",
    py: "python", sh: "shell", bash: "shell",
    java: "java", php: "php", rb: "ruby",
    md: "markdown", txt: "plaintext",
    properties: "properties", conf: "ini", ini: "ini",
    toml: "toml", env: "plaintext", gitignore: "plaintext",
    dockerfile: "dockerfile",
  };
  return map[ext] || "plaintext";
}

function getFileIcon(entry: FileEntry) {
  if (!entry.is_file) return <Folder className="w-4 h-4 text-yellow-400" />;
  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  if (["js", "ts", "jsx", "tsx", "py", "java", "php", "rb", "sh"].includes(ext))
    return <Code2 className="w-4 h-4 text-blue-400" />;
  if (["json", "yaml", "yml", "toml", "xml", "conf", "ini", "properties", "env"].includes(ext))
    return <Settings className="w-4 h-4 text-purple-400" />;
  if (["md", "txt", "log"].includes(ext))
    return <FileText className="w-4 h-4 text-zinc-400" />;
  return <FileIcon className="w-4 h-4 text-zinc-500" />;
}

// ── Power Action Buttons ───────────────────
function PowerButtons({ onAction, isRunning, loading }: {
  onAction: (a: "start" | "stop" | "restart" | "kill") => void;
  isRunning: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        className="h-8 gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 font-semibold"
        onClick={() => onAction("start")}
        disabled={loading}
        title="Démarrer"
      >
        <Play className="w-3.5 h-3.5 fill-current" />
        <span className="hidden sm:inline">Démarrer</span>
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1.5 text-xs bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20 border border-yellow-400/20 font-semibold"
        onClick={() => onAction("restart")}
        disabled={loading}
        title="Redémarrer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Redémarrer</span>
      </Button>
      <Button
        size="sm"
        className="h-8 gap-1.5 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 font-semibold"
        onClick={() => onAction("stop")}
        disabled={loading}
        title="Arrêter"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
        <span className="hidden sm:inline">Arrêter</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
        onClick={() => onAction("kill")}
        disabled={loading}
        title="Forcer l'arrêt (kill)"
      >
        <Skull className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ── Console component ─────────────────────
function ConsolePanel({
  identifier,
  onAction,
  isRunning,
  powerLoading,
}: {
  identifier: string;
  onAction: (a: "start" | "stop" | "restart" | "kill") => void;
  isRunning: boolean;
  powerLoading?: boolean;
}) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [command, setCommand] = useState("");
  const [serverState, setServerState] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualDisconnect = useRef(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  function addLine(text: string, type: ConsoleLine["type"] = "output") {
    setLines(prev => [...prev.slice(-500), { text, ts: Date.now(), type }]);
  }

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function getWsUrl() {
    const token = localStorage.getItem("flyhost_token") || "";
    const isHttps = window.location.protocol === "https:";
    const proto = isHttps ? "wss:" : "ws:";
    const host = window.location.host;
    return `${proto}//${host}/api/ws/servers/${identifier}?token=${encodeURIComponent(token)}`;
  }

  function connect() {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    manualDisconnect.current = false;
    setConnecting(true);

    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        // no log needed — auth success confirms connection
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.event === "flyhost_error") {
            addLine(`Erreur: ${msg.args[0]}`, "error");
            setConnected(false); setConnecting(false);
            return;
          }
          if (msg.event === "flyhost_disconnected") {
            setConnected(false); setConnecting(false);
            return;
          }
          if (msg.event === "auth success") {
            setConnected(true); setConnecting(false);
            addLine("✓ Console connectée", "system");
            ws.send(JSON.stringify({ event: "send logs", args: [null] }));
          } else if (msg.event === "console output") {
            const clean = stripAnsi(msg.args[0] || "");
            if (clean.trim()) addLine(clean, "output");
          } else if (msg.event === "status") {
            const state = msg.args[0] || "";
            setServerState(state);
            addLine(`● État: ${state}`, "system");
          } else if (msg.event === "stats") {
            if (msg.args?.[0]) {
              try { const s = JSON.parse(msg.args[0]); if (s.state) setServerState(s.state); } catch {}
            }
          } else if (msg.event === "daemon error") {
            addLine(`[Daemon] ${msg.args[0]}`, "error");
          } else if (msg.event === "install output") {
            const clean = stripAnsi(msg.args[0] || "");
            if (clean.trim()) addLine(`[Install] ${clean}`, "output");
          }
        } catch {}
      };

      ws.onerror = () => {
        setConnected(false); setConnecting(false);
      };

      ws.onclose = (e) => {
        setConnected(false); setConnecting(false);
        if (wsRef.current === ws) {
          wsRef.current = null;
          // Auto-reconnect after 3s unless user manually disconnected
          if (!manualDisconnect.current) {
            addLine("Reconnexion dans 3s…", "system");
            reconnectRef.current = setTimeout(() => { connect(); }, 3000);
          }
        }
      };
    } catch (err: any) {
      addLine(`Erreur: ${err.message}`, "error");
      setConnecting(false);
      if (!manualDisconnect.current) {
        reconnectRef.current = setTimeout(() => { connect(); }, 4000);
      }
    }
  }

  function disconnect() {
    manualDisconnect.current = true;
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }

  function sendCommand() {
    if (!command.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ event: "send command", args: [command] }));
    addLine(`> ${command}`, "system");
    setCommand("");
  }

  // Auto-connect when component mounts
  useEffect(() => {
    connect();
    return () => {
      manualDisconnect.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, []);

  const stateColor =
    serverState === "running" ? "text-emerald-400" :
    serverState === "starting" ? "text-yellow-400" :
    serverState === "stopping" ? "text-orange-400" :
    "text-zinc-600";

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Power actions bar */}
      <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 flex-shrink-0 flex-wrap gap-y-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            serverState === "running" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" :
            serverState === "starting" ? "bg-yellow-400 animate-pulse" :
            serverState === "stopping" ? "bg-orange-400 animate-pulse" :
            "bg-zinc-600"
          }`} />
          <span className={`text-xs font-semibold ${stateColor} capitalize`}>
            {serverState || "inconnu"}
          </span>
        </div>
        <PowerButtons onAction={onAction} isRunning={isRunning} loading={powerLoading} />
      </div>

      {/* Console toolbar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={`flex items-center gap-2 text-xs font-medium ${connected ? "text-emerald-400" : connecting ? "text-yellow-400" : "text-zinc-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400" : connecting ? "bg-yellow-400 animate-pulse" : "bg-zinc-600 animate-pulse"}`} />
          {connected ? "Console connectée" : connecting ? "Connexion en cours…" : "Reconnexion…"}
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-white gap-1 px-2" onClick={() => setLines([])}>
          <X className="w-3 h-3" /> Effacer
        </Button>
        {!connected && !connecting && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10 gap-1 px-2" onClick={() => { manualDisconnect.current = false; connect(); }}>
            <Play className="w-3 h-3 fill-current" /> Reconnecter
          </Button>
        )}
        {connected && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 hover:text-red-400 gap-1 px-2" onClick={disconnect}>
            <Square className="w-3 h-3" /> Déconnecter
          </Button>
        )}
      </div>

      {/* Console output */}
      <div className="flex-1 min-h-0 rounded-xl border border-zinc-800 bg-black overflow-y-auto font-mono text-xs p-4 space-y-0.5">
        {lines.length === 0 ? (
          <p className="text-zinc-700 italic">{connecting ? "Connexion à la console…" : "En attente des logs du serveur…"}</p>
        ) : (
          lines.map((line, i) => (
            <div
              key={i}
              className={`leading-5 whitespace-pre-wrap break-all ${
                line.type === "system" ? "text-yellow-400/70" :
                line.type === "error" ? "text-red-400" :
                "text-zinc-300"
              }`}
            >
              {line.text}
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Command input */}
      <div className="flex gap-2 flex-shrink-0">
        <span className="flex items-center px-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-600 text-xs font-mono">
          <ChevronRight className="w-3 h-3" />
        </span>
        <Input
          className="flex-1 bg-zinc-900 border-zinc-800 font-mono text-sm focus:border-yellow-400/50 h-9"
          placeholder={connected ? "Tapez une commande…" : "Connectez-vous pour envoyer des commandes"}
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendCommand()}
          disabled={!connected}
        />
        <Button
          onClick={sendCommand}
          disabled={!connected || !command.trim()}
          className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold h-9 px-4"
        >
          Envoyer
        </Button>
      </div>
    </div>
  );
}

// ── File Manager component ──────────────────
function FilesPanel({ identifier }: { identifier: string }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [pathHistory, setPathHistory] = useState<string[]>(["/"]);
  // Mobile: show "list" or "editor"
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");
  const { toast } = useToast();

  async function loadFiles(path = "/") {
    setLoading(true);
    setSelectedFile(null);
    setFileContent("");
    try {
      const res = await fetch(`/api/servers/${identifier}/files?directory=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.ok) {
        const list: FileEntry[] = (data.data || []).map((f: any) => ({ ...f.attributes }));
        list.sort((a, b) => {
          if (a.is_file === b.is_file) return a.name.localeCompare(b.name);
          return a.is_file ? 1 : -1;
        });
        setFiles(list);
        setCurrentPath(path);
      } else {
        toast({ variant: "destructive", title: "Erreur", description: data.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur réseau", description: e.message });
    }
    setLoading(false);
  }

  async function openFile(entry: FileEntry) {
    if (!entry.is_file) {
      const newPath = `${currentPath === "/" ? "" : currentPath}/${entry.name}`;
      setPathHistory(h => [...h, currentPath]);
      await loadFiles(newPath);
      return;
    }
    if (entry.size > 1024 * 1024) {
      toast({ variant: "destructive", title: "Fichier trop grand", description: "Max 1 Mo pour l'édition en ligne" });
      return;
    }
    setLoadingFile(true);
    const filePath = `${currentPath === "/" ? "" : currentPath}/${entry.name}`;
    try {
      const res = await fetch(`/api/servers/${identifier}/files/contents?file=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedFile(filePath);
        setFileContent(data.content);
        setOriginalContent(data.content);
        setMobileView("editor"); // auto-switch to editor on mobile
      } else {
        toast({ variant: "destructive", title: "Erreur lecture", description: data.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setLoadingFile(false);
  }

  async function saveFile() {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: selectedFile, content: fileContent }),
      });
      const data = await res.json();
      if (res.ok) {
        setOriginalContent(fileContent);
        toast({ title: "Fichier sauvegardé ✓" });
      } else {
        toast({ variant: "destructive", title: "Erreur sauvegarde", description: data.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setSaving(false);
  }

  async function deleteFile(entry: FileEntry) {
    if (!confirm(`Supprimer "${entry.name}" ?`)) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: currentPath, files: [entry.name] }),
      });
      if (res.ok) {
        toast({ title: `${entry.name} supprimé` });
        await loadFiles(currentPath);
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/files/folder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directory: currentPath, name: newFolderName }),
      });
      if (res.ok) {
        toast({ title: `Dossier "${newFolderName}" créé` });
        setNewFolderName(""); setShowNewFolder(false);
        await loadFiles(currentPath);
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
  }

  function goBack() {
    const history = [...pathHistory];
    const prev = history.pop() || "/";
    setPathHistory(history);
    loadFiles(prev);
  }

  useEffect(() => { loadFiles("/"); }, [identifier]);

  const isDirty = fileContent !== originalContent;
  const pathParts = currentPath.split("/").filter(Boolean);
  const openFileName = selectedFile?.split("/").pop() || "";

  // ── File list panel ──
  const fileListPanel = (
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-zinc-500 flex-wrap min-w-0">
        <button onClick={() => { setPathHistory([]); loadFiles("/"); }} className="hover:text-yellow-400 flex-shrink-0">
          <Home className="w-3 h-3" />
        </button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <span className="text-zinc-400 truncate max-w-[80px]">{part}</span>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {pathHistory.length > 0 && (
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-white" onClick={goBack}>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-white" onClick={() => loadFiles(currentPath)} title="Rafraîchir">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-yellow-400" onClick={() => setShowNewFolder(!showNewFolder)} title="Nouveau dossier">
          <Plus className="w-3.5 h-3.5" />
        </Button>
        {/* Mobile: switch to editor */}
        {selectedFile && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-yellow-400 ml-auto sm:hidden" onClick={() => setMobileView("editor")}>
            <Code2 className="w-3 h-3" /> Éditeur
          </Button>
        )}
      </div>

      {showNewFolder && (
        <div className="flex gap-1 flex-shrink-0">
          <Input
            className="h-7 text-xs bg-zinc-900 border-zinc-700 flex-1"
            placeholder="Nom du dossier"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createFolder()}
            autoFocus
          />
          <Button size="sm" className="h-7 px-2 bg-yellow-400 text-black hover:bg-yellow-300" onClick={createFolder}>
            <CheckCircle2 className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-zinc-600 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : files.length === 0 ? (
          <div className="py-8 text-center text-zinc-700 text-xs">Dossier vide</div>
        ) : (
          files.map(entry => {
            const fp = `${currentPath === "/" ? "" : currentPath}/${entry.name}`;
            const isSelected = selectedFile === fp;
            return (
              <div
                key={entry.name}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800/80 border-b border-zinc-900/60 transition-colors ${
                  isSelected ? "bg-zinc-800 border-l-2 border-l-yellow-400" : ""
                }`}
                onClick={() => openFile(entry)}
              >
                <div className="flex-shrink-0">{getFileIcon(entry)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 truncate">{entry.name}</p>
                  {entry.is_file && <p className="text-xs text-zinc-700">{fmtSize(entry.size)}</p>}
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 flex-shrink-0 p-1"
                  onClick={e => { e.stopPropagation(); deleteFile(entry); }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ── Editor panel ──
  const editorPanel = (
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* Editor toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 flex-shrink-0 min-w-0">
        {/* Mobile: back to file list */}
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-white sm:hidden flex-shrink-0" onClick={() => setMobileView("list")}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <FileText className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        <span className="text-xs text-zinc-300 font-mono flex-1 truncate min-w-0">{selectedFile || "Aucun fichier"}</span>
        {isDirty && (
          <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20 text-xs flex-shrink-0 hidden sm:flex">
            Modifié
          </Badge>
        )}
        <Button
          size="sm"
          onClick={saveFile}
          disabled={saving || !isDirty || !selectedFile}
          className={`h-7 gap-1 text-xs flex-shrink-0 ${isDirty && selectedFile ? "bg-yellow-400 text-black hover:bg-yellow-300 font-semibold" : "bg-zinc-800 text-zinc-600"}`}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          <span className="hidden sm:inline">Sauvegarder</span>
          <span className="sm:hidden">Sauv.</span>
        </Button>
        {selectedFile && (
          <Button
            size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-zinc-500 hover:text-white flex-shrink-0"
            onClick={() => { setSelectedFile(null); setFileContent(""); setMobileView("list"); }}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Monaco editor */}
      <div className="flex-1 min-h-0 rounded-xl border border-zinc-800 overflow-hidden">
        {loadingFile ? (
          <div className="flex items-center justify-center h-full text-zinc-600 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
          </div>
        ) : selectedFile ? (
          <Editor
            height="100%"
            defaultLanguage={getFileLanguage(openFileName)}
            language={getFileLanguage(openFileName)}
            value={fileContent}
            onChange={v => setFileContent(v || "")}
            theme="vs-dark"
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              lineNumbers: "on",
              folding: true,
              tabSize: 2,
              renderLineHighlight: "line",
              smoothScrolling: true,
              cursorBlinking: "smooth",
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Code2 className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-zinc-600 text-sm">Aucun fichier ouvert</p>
            <button
              className="mt-3 text-xs text-yellow-400 hover:text-yellow-300 sm:hidden"
              onClick={() => setMobileView("list")}
            >
              ← Retour aux fichiers
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Desktop: always both panels */}
      <div className="hidden sm:flex gap-4 w-full h-full min-h-0">
        <div className="w-56 flex-shrink-0 flex flex-col min-h-0">{fileListPanel}</div>
        <div className="flex-1 min-w-0 flex flex-col min-h-0">{editorPanel}</div>
      </div>

      {/* Mobile: toggle between list and editor */}
      <div className="sm:hidden flex flex-col w-full h-full min-h-0">
        {mobileView === "list" ? fileListPanel : editorPanel}
      </div>
    </div>
  );
}

// ── Startup panel ────────────────────────
function StartupPanel({ identifier }: { identifier: string }) {
  const [startupData, setStartupData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const { toast } = useToast();

  async function loadStartup() {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/startup`);
      if (res.ok) {
        const data = await res.json();
        setStartupData(data);
        const vals: Record<string, string> = {};
        (data.data || []).forEach((v: any) => {
          vals[v.attributes.env_variable] = v.attributes.server_value ?? v.attributes.default_value ?? "";
        });
        setEditValues(vals);
      } else {
        toast({ variant: "destructive", title: "Erreur chargement startup" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setLoading(false);
  }

  async function saveVariable(key: string) {
    setSaving(key);
    try {
      const res = await fetch(`/api/servers/${identifier}/startup/variable`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: editValues[key] ?? "" }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: `Variable "${key}" mise à jour ✓` });
        await loadStartup();
      } else {
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setSaving(null);
  }

  useEffect(() => { loadStartup(); }, [identifier]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-600 gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Chargement des variables de démarrage…
      </div>
    );
  }

  const variables = startupData?.data || [];
  const startupCommand = startupData?.meta?.startup_command || startupData?.attributes?.command || "";
  const rawStartup = startupData?.meta?.raw_startup_command || "";

  return (
    <div className="space-y-5 overflow-y-auto h-full pb-4">
      {/* Startup command display */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <Play className="w-4 h-4 text-yellow-400" /> Commande de démarrage
        </h3>
        <p className="text-xs text-zinc-500 mb-3">Commande utilisée pour démarrer ce serveur</p>
        {startupCommand && (
          <div className="rounded-lg bg-black border border-zinc-800 p-3 font-mono text-xs text-zinc-300 break-all mb-2">
            {startupCommand}
          </div>
        )}
        {rawStartup && rawStartup !== startupCommand && (
          <div className="text-xs text-zinc-600">
            <span className="text-zinc-500">Template : </span>
            <span className="font-mono">{rawStartup}</span>
          </div>
        )}
        {!startupCommand && (
          <p className="text-xs text-zinc-600 italic">Commande non disponible</p>
        )}
      </div>

      {/* Variables */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-yellow-400" /> Variables de démarrage
            <span className="text-xs font-normal text-zinc-600">({variables.length})</span>
          </h3>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500 gap-1" onClick={loadStartup}>
            <RefreshCw className="w-3 h-3" /> Rafraîchir
          </Button>
        </div>

        {variables.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">Aucune variable de démarrage configurée</p>
        ) : (
          <div className="space-y-4">
            {variables.map((v: any) => {
              const attr = v.attributes;
              const key = attr.env_variable;
              const isEditable = attr.user_editable;
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">{attr.name || key}</label>
                    {!isEditable && (
                      <span className="text-xs text-zinc-700 border border-zinc-800 rounded px-1.5 py-0.5">Lecture seule</span>
                    )}
                  </div>
                  {attr.description && (
                    <p className="text-xs text-zinc-600">{attr.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      className="flex-1 bg-zinc-900 border-zinc-700 font-mono text-sm h-9"
                      value={editValues[key] ?? ""}
                      onChange={e => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                      disabled={!isEditable}
                      placeholder={attr.default_value || ""}
                    />
                    {isEditable && (
                      <Button
                        size="sm"
                        className="h-9 px-3 bg-yellow-400 text-black hover:bg-yellow-300 font-semibold gap-1"
                        onClick={() => saveVariable(key)}
                        disabled={saving === key}
                      >
                        {saving === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Sauver
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-zinc-700 font-mono">ENV: {key}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Deploy panel ──────────────────────────
function DeployPanel({ identifier, serverName }: { identifier: string; serverName: string }) {
  const [gitUrl, setGitUrl] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [deploying, setDeploying] = useState(false);
  const { toast } = useToast();
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [deployLog]);

  function addLog(msg: string) {
    setDeployLog(p => [...p, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  async function deployFromGit() {
    if (!gitUrl.trim()) {
      toast({ variant: "destructive", title: "URL Git requise" });
      return;
    }
    setDeploying(true); setDeployLog([]);
    addLog(`Déploiement depuis ${gitUrl} (branche: ${gitBranch})`);
    try {
      const deployScript = `#!/bin/bash\nset -e\necho "[FlyHost Deploy] Starting..."\nif [ -d ".git" ]; then\n  git fetch origin && git checkout ${gitBranch} && git pull origin ${gitBranch}\nelse\n  git clone -b ${gitBranch} ${gitUrl} .\nfi\nif [ -f "package.json" ]; then npm install; fi\nif [ -f "requirements.txt" ]; then pip install -r requirements.txt; fi\necho "[FlyHost Deploy] Done!"\n`;
      const writeRes = await fetch(`/api/servers/${identifier}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: "/flyhost-deploy.sh", content: deployScript }),
      });
      if (!writeRes.ok) { const d = await writeRes.json(); throw new Error(d.error); }
      addLog("Script écrit sur le serveur ✓");
      addLog("Allez dans Console → connectez → exécutez: bash /flyhost-deploy.sh");
    } catch (e: any) {
      addLog(`Erreur: ${e.message}`);
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setDeploying(false);
  }

  async function uploadAndDeploy(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    addLog(`Upload de ${file.name}…`);
    const content = await file.text();
    try {
      const res = await fetch(`/api/servers/${identifier}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: `/${file.name}`, content }),
      });
      if (res.ok) { addLog(`✓ ${file.name} uploadé !`); toast({ title: `${file.name} uploadé` }); }
      else { const d = await res.json(); addLog(`Erreur: ${d.error}`); }
    } catch (e: any) { addLog(`Erreur: ${e.message}`); }
    e.target.value = "";
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-yellow-400" /> Déployer depuis Git
        </h3>
        <p className="text-xs text-zinc-500 mb-4">Clonez ou mettez à jour depuis un dépôt Git</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">URL du dépôt</label>
            <Input placeholder="https://github.com/user/repo.git" value={gitUrl} onChange={e => setGitUrl(e.target.value)} className="bg-zinc-900 border-zinc-700 font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Branche</label>
            <Input placeholder="main" value={gitBranch} onChange={e => setGitBranch(e.target.value)} className="bg-zinc-900 border-zinc-700 font-mono text-sm max-w-48" />
          </div>
          <Button onClick={deployFromGit} disabled={deploying || !gitUrl.trim()} className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold gap-2">
            {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
            {deploying ? "Déploiement…" : "Déployer"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <Upload className="w-4 h-4 text-yellow-400" /> Upload de fichier
        </h3>
        <p className="text-xs text-zinc-500 mb-4">Uploadez un fichier texte directement sur le serveur</p>
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <div className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-yellow-400/30 hover:bg-zinc-800 transition-all text-sm text-zinc-400 hover:text-white flex items-center gap-2">
            <Upload className="w-4 h-4" /> Choisir un fichier
          </div>
          <input type="file" className="hidden" onChange={uploadAndDeploy} />
        </label>
      </div>

      {deployLog.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-black p-4 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
          {deployLog.map((line, i) => (
            <div key={i} className={line.includes("Erreur") ? "text-red-400" : line.includes("✓") ? "text-emerald-400" : "text-zinc-400"}>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────
export default function ServerDetailPage() {
  const [, params] = useRoute("/servers/:identifier");
  const [, navigate] = useLocation();
  const identifier = params?.identifier || "";

  const [server, setServer] = useState<ServerInfo | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"console" | "files" | "deploy" | "startup" | "settings">("console");
  const [powerLoading, setPowerLoading] = useState(false);
  const [deletingServer, setDeletingServer] = useState(false);
  const { toast } = useToast();

  async function loadServer() {
    try {
      const res = await fetch("/api/servers");
      if (res.ok) {
        const data = await res.json();
        const srv = data.servers?.find((s: any) =>
          s.identifier === identifier || s.identifier.startsWith(identifier)
        );
        if (srv) setServer(srv);
      }
    } catch {}
    setLoading(false);
  }

  async function loadStats() {
    try {
      const res = await fetch(`/api/servers/${identifier}/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.attributes);
      }
    } catch {}
  }

  async function powerAction(action: "start" | "stop" | "restart" | "kill") {
    setPowerLoading(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const labels: Record<string, string> = { start: "démarrage", stop: "arrêt", restart: "redémarrage", kill: "arrêt forcé" };
        toast({ title: `Serveur: ${labels[action]} en cours…` });
        setTimeout(loadStats, 1500);
        setTimeout(loadStats, 4000);
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setPowerLoading(false);
  }

  async function deleteServer() {
    if (!server) return;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${server.name}" ?\n\nCette action est IRRÉVERSIBLE — toutes les données seront perdues.`)) return;
    if (!confirm(`Confirmation finale: supprimer le serveur "${server.name}" définitivement ?`)) return;

    setDeletingServer(true);
    try {
      const res = await fetch(`/api/servers/${identifier}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Serveur supprimé", description: "Le serveur a été supprimé avec succès." });
        navigate("/servers");
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur suppression", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
    setDeletingServer(false);
  }

  useEffect(() => {
    loadServer();
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [identifier]);

  const memPercent = stats ? Math.min(100, Math.round(((stats.resources?.memory_bytes || 0) / 1024 / 1024) / (server?.limits.memory || 1) * 100)) : 0;
  const cpuPercent = stats ? Math.min(100, Math.round(stats.resources?.cpu_absolute || 0)) : 0;
  const diskPercent = stats ? Math.min(100, Math.round(((stats.resources?.disk_bytes || 0) / 1024 / 1024) / (server?.limits.disk || 1) * 100)) : 0;
  const isRunning = stats?.current_state === "running";
  const currentState = stats?.current_state || "inconnu";

  const TABS = [
    { id: "console", label: "Console", icon: Terminal },
    { id: "files", label: "Fichiers", icon: FolderOpen },
    { id: "deploy", label: "Déployer", icon: GitBranch },
    { id: "startup", label: "Startup", icon: Play },
    { id: "settings", label: "Paramètres", icon: Settings },
  ] as const;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-120px)] gap-3">
        {/* Header */}
        <div className="flex-shrink-0">
          <Link href="/servers">
            <button className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Mes serveurs
            </button>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isRunning ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" :
                currentState === "starting" ? "bg-yellow-400 animate-pulse" :
                currentState === "stopping" ? "bg-orange-400 animate-pulse" :
                "bg-zinc-600"
              }`} />
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white truncate">{server?.name || identifier}</h1>
                <div className="flex items-center gap-2 text-xs text-zinc-600 mt-0.5 flex-wrap">
                  <span className="font-mono">{identifier}</span>
                  {server?.allocation && <span className="font-mono">{server.allocation.ip}:{server.allocation.port}</span>}
                  <Badge className={`text-xs h-4 px-1.5 ${
                    isRunning ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    currentState === "starting" ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" :
                    "bg-zinc-800 text-zinc-500 border-zinc-700"
                  }`}>
                    {currentState}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Resource bars — compact header */}
            {stats && (
              <div className="hidden md:flex items-center gap-3 text-xs flex-shrink-0">
                {[
                  { label: "CPU", value: cpuPercent, color: "bg-blue-400" },
                  { label: "RAM", value: memPercent, color: "bg-purple-400" },
                  { label: "Disk", value: diskPercent, color: "bg-orange-400" },
                ].map(r => (
                  <div key={r.label} className="flex items-center gap-1.5">
                    <span className="text-zinc-600 w-6">{r.label}</span>
                    <div className="w-14 h-1 rounded-full bg-zinc-800">
                      <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.value}%` }} />
                    </div>
                    <span className="text-zinc-500 w-8">{r.value}%</span>
                  </div>
                ))}
                <a href={`https://panel.lionelmelo.qzz.io/server/${identifier}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-600 hover:text-white" title="Panel Pterodactyl">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl border border-zinc-800 bg-zinc-900/50 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all flex-1 sm:flex-none justify-center sm:justify-start ${
                activeTab === tab.id ? "bg-yellow-400 text-black" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0">
          {activeTab === "console" && (
            <ConsolePanel
              identifier={identifier}
              onAction={powerAction}
              isRunning={isRunning}
              powerLoading={powerLoading}
            />
          )}
          {activeTab === "files" && <FilesPanel identifier={identifier} />}
          {activeTab === "deploy" && (
            <div className="h-full overflow-y-auto">
              <DeployPanel identifier={identifier} serverName={server?.name || ""} />
            </div>
          )}
          {activeTab === "startup" && <StartupPanel identifier={identifier} />}
          {activeTab === "settings" && (
            <div className="space-y-4 overflow-y-auto h-full pb-4">
              {/* Resource limits */}
              {server && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-yellow-400" /> Ressources allouées
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "RAM", value: fmtMb(server.limits.memory), icon: MemoryStick, color: "text-purple-400" },
                      { label: "Stockage", value: fmtMb(server.limits.disk), icon: HardDrive, color: "text-orange-400" },
                      { label: "CPU", value: `${server.limits.cpu}%`, icon: Cpu, color: "text-blue-400" },
                    ].map(r => (
                      <div key={r.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
                        <r.icon className={`w-5 h-5 mx-auto mb-2 ${r.color}`} />
                        <p className={`text-lg font-bold ${r.color}`}>{r.value}</p>
                        <p className="text-xs text-zinc-600 mt-1">{r.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live stats */}
              {stats && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" /> Utilisation en temps réel
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "CPU", value: `${cpuPercent}%`, bar: cpuPercent, color: "bg-blue-400" },
                      { label: "RAM", value: `${Math.round((stats.resources?.memory_bytes || 0) / 1024 / 1024)} Mo`, bar: memPercent, color: "bg-purple-400" },
                      { label: "Disque", value: `${Math.round((stats.resources?.disk_bytes || 0) / 1024 / 1024)} Mo`, bar: diskPercent, color: "bg-orange-400" },
                      { label: "Réseau ↓", value: `${Math.round((stats.resources?.network_rx_bytes || 0) / 1024)} Ko`, bar: 0, color: "bg-emerald-400" },
                    ].map(r => (
                      <div key={r.label} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">{r.label}</span>
                          <span className="text-white font-medium">{r.value}</span>
                        </div>
                        {r.bar > 0 && (
                          <div className="h-1.5 rounded-full bg-zinc-800">
                            <div className={`h-full rounded-full ${r.color} transition-all duration-500`} style={{ width: `${r.bar}%` }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Power actions */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" /> Actions serveur
                </h3>
                <PowerButtons onAction={powerAction} isRunning={isRunning} loading={powerLoading} />
              </div>

              {/* Danger zone */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/3 p-5">
                <h3 className="text-base font-semibold text-red-400 mb-1 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Zone de danger
                </h3>
                <p className="text-xs text-zinc-600 mb-4">Les actions suivantes sont irréversibles.</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    className="text-red-400 border border-red-500/30 hover:bg-red-500/10 text-sm gap-2"
                    onClick={() => powerAction("kill")}
                    disabled={powerLoading}
                  >
                    <Skull className="w-3.5 h-3.5" /> Forcer l'arrêt (kill)
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-red-500 border border-red-600/40 hover:bg-red-600/10 text-sm gap-2"
                    onClick={deleteServer}
                    disabled={deletingServer}
                  >
                    {deletingServer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Supprimer le serveur
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
