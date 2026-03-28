import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, Link } from "wouter";
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
  Download,
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

// ── Console component ─────────────────────
function ConsolePanel({ identifier, serverUuid }: { identifier: string; serverUuid: string }) {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [command, setCommand] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  function addLine(text: string, type: ConsoleLine["type"] = "output") {
    setLines(prev => [...prev.slice(-500), { text, ts: Date.now(), type }]);
  }

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function getWsUrl() {
    // Build WebSocket URL to our backend proxy
    const token = localStorage.getItem("flyhost_token") || "";
    const isHttps = window.location.protocol === "https:";
    const proto = isHttps ? "wss:" : "ws:";
    const host = window.location.host;
    return `${proto}//${host}/api/ws/servers/${identifier}?token=${encodeURIComponent(token)}`;
  }

  function connect() {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setConnecting(true);
    addLine("Connexion au serveur...", "system");

    try {
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Backend proxy handles auth automatically
        addLine("WebSocket ouvert, authentification...", "system");
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.event === "flyhost_error") {
            addLine(`Erreur: ${msg.args[0]}`, "error");
            setConnected(false);
            setConnecting(false);
            return;
          }
          if (msg.event === "flyhost_disconnected") {
            addLine("Connexion Pterodactyl fermée", "system");
            setConnected(false);
            setConnecting(false);
            return;
          }

          if (msg.event === "auth success") {
            setConnected(true);
            setConnecting(false);
            addLine("✓ Console connectée", "system");
            ws.send(JSON.stringify({ event: "send logs", args: [null] }));
          } else if (msg.event === "console output") {
            // Strip ANSI codes
            const clean = (msg.args[0] || "").replace(/\x1b\[[0-9;]*m/g, "");
            if (clean.trim()) addLine(clean, "output");
          } else if (msg.event === "status") {
            addLine(`● Serveur: ${msg.args[0]}`, "system");
          } else if (msg.event === "stats") {
            // Ignore stats events (too noisy)
          } else if (msg.event === "daemon error") {
            addLine(`[Daemon] ${msg.args[0]}`, "error");
          } else if (msg.event === "install output") {
            addLine(`[Install] ${msg.args[0]}`, "output");
          }
        } catch {}
      };

      ws.onerror = () => {
        addLine("Erreur WebSocket — connexion interrompue", "error");
        setConnected(false);
        setConnecting(false);
      };

      ws.onclose = (e) => {
        setConnected(false);
        setConnecting(false);
        if (wsRef.current === ws) {
          addLine(`Connexion fermée (code: ${e.code})`, "system");
          wsRef.current = null;
        }
      };
    } catch (err: any) {
      addLine(`Erreur: ${err.message}`, "error");
      setConnecting(false);
    }
  }

  function disconnect() {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    addLine("Déconnecté manuellement", "system");
  }

  function sendCommand() {
    if (!command.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ event: "send command", args: [command] }));
    addLine(`> ${command}`, "system");
    setCommand("");
  }

  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className={`flex items-center gap-2 text-sm font-medium ${connected ? "text-emerald-400" : connecting ? "text-yellow-400" : "text-zinc-600"}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : connecting ? "bg-yellow-400 animate-pulse" : "bg-zinc-600"}`} />
          {connected ? "Connecté" : connecting ? "Connexion…" : "Déconnecté"}
        </div>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-zinc-400 hover:text-white gap-1"
          onClick={() => setLines([])}
        >
          <X className="w-3 h-3" /> Effacer
        </Button>
        {connected ? (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-red-500/10 gap-1" onClick={disconnect}>
            <Square className="w-3 h-3" /> Déconnecter
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs bg-emerald-500 hover:bg-emerald-400 text-black font-semibold gap-1"
            onClick={connect}
            disabled={connecting}
          >
            {connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            Connecter
          </Button>
        )}
      </div>

      {/* Console output */}
      <div className="flex-1 min-h-0 rounded-xl border border-zinc-800 bg-black overflow-y-auto font-mono text-xs p-4 space-y-0.5">
        {lines.length === 0 ? (
          <p className="text-zinc-700 italic">Cliquez sur "Connecter" pour ouvrir la console…</p>
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
              {/* Strip ANSI color codes for display */}
              {line.text.replace(/\x1b\[[0-9;]*m/g, "")}
            </div>
          ))
        )}
        <div ref={consoleEndRef} />
      </div>

      {/* Command input */}
      <div className="flex gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-600 text-xs font-mono flex-shrink-0">
          <ChevronRight className="w-3 h-3" />
        </div>
        <Input
          className="flex-1 bg-zinc-900 border-zinc-800 font-mono text-sm focus:border-yellow-400/50"
          placeholder={connected ? "Tapez une commande…" : "Console déconnectée"}
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendCommand()}
          disabled={!connected}
        />
        <Button
          onClick={sendCommand}
          disabled={!connected || !command.trim()}
          className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold"
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
  const { toast } = useToast();

  async function loadFiles(path = "/") {
    setLoading(true);
    setSelectedFile(null);
    setFileContent("");
    try {
      const res = await fetch(`/api/servers/${identifier}/files?directory=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.ok) {
        const list: FileEntry[] = (data.data || []).map((f: any) => ({
          ...f.attributes,
        }));
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
    const filePath = entry.name;
    try {
      const res = await fetch(`/api/servers/${identifier}/files`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: currentPath, files: [filePath] }),
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
        setNewFolderName("");
        setShowNewFolder(false);
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

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* File tree */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-2 min-h-0">
        {/* Path breadcrumb */}
        <div className="flex items-center gap-1 text-xs text-zinc-500 flex-wrap">
          <button onClick={() => { setPathHistory([]); loadFiles("/"); }} className="hover:text-yellow-400">
            <Home className="w-3 h-3" />
          </button>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              <span className="text-zinc-400">{part}</span>
            </span>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1">
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
        </div>

        {/* New folder input */}
        {showNewFolder && (
          <div className="flex gap-1">
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
            <div className="flex items-center justify-center py-8 text-zinc-600 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
            </div>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-zinc-700 text-xs">Dossier vide</div>
          ) : (
            files.map(entry => (
              <div
                key={entry.name}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800/80 border-b border-zinc-900 transition-colors ${
                  selectedFile === `${currentPath === "/" ? "" : currentPath}/${entry.name}` ? "bg-zinc-800 border-l-2 border-l-yellow-400" : ""
                }`}
                onClick={() => openFile(entry)}
              >
                <div className="flex-shrink-0">{getFileIcon(entry)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 truncate">{entry.name}</p>
                  {entry.is_file && (
                    <p className="text-xs text-zinc-700">{fmtSize(entry.size)}</p>
                  )}
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 flex-shrink-0"
                  onClick={e => { e.stopPropagation(); deleteFile(entry); }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
        {selectedFile ? (
          <>
            {/* Editor toolbar */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 flex-shrink-0">
              <FileText className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              <span className="text-sm text-zinc-300 font-mono flex-1 truncate">{selectedFile}</span>
              {isDirty && (
                <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20 text-xs flex-shrink-0">
                  Modifié
                </Badge>
              )}
              <Button
                size="sm"
                onClick={saveFile}
                disabled={saving || !isDirty}
                className={`h-7 gap-1 text-xs flex-shrink-0 ${isDirty ? "bg-yellow-400 text-black hover:bg-yellow-300 font-semibold" : "bg-zinc-800 text-zinc-600"}`}
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Sauvegarder
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-zinc-500 hover:text-white flex-shrink-0"
                onClick={() => { setSelectedFile(null); setFileContent(""); }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Monaco editor */}
            <div className="flex-1 min-h-0 rounded-xl border border-zinc-800 overflow-hidden">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full text-zinc-600 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement du fichier…
                </div>
              ) : (
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
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center border border-dashed border-zinc-800 rounded-xl">
            <Code2 className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-zinc-600 text-sm">Sélectionnez un fichier pour l'éditer</p>
            <p className="text-zinc-700 text-xs mt-1">Cliquez sur un fichier dans l'arborescence</p>
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
    setDeploying(true);
    setDeployLog([]);
    addLog(`Déploiement depuis ${gitUrl} (branche: ${gitBranch})`);
    addLog("Connexion au serveur...");

    try {
      // Write a deploy script to the server and execute it via console
      const deployScript = `#!/bin/bash
set -e
echo "[FlyHost Deploy] Starting..."
if [ -d ".git" ]; then
  echo "[FlyHost Deploy] Updating existing repo..."
  git fetch origin
  git checkout ${gitBranch}
  git pull origin ${gitBranch}
else
  echo "[FlyHost Deploy] Cloning repository..."
  git clone -b ${gitBranch} ${gitUrl} .
fi
echo "[FlyHost Deploy] Installing dependencies..."
if [ -f "package.json" ]; then npm install; fi
if [ -f "requirements.txt" ]; then pip install -r requirements.txt; fi
if [ -f "composer.json" ]; then composer install; fi
echo "[FlyHost Deploy] Done!"
`;

      const writeRes = await fetch(`/api/servers/${identifier}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: "/deploy.sh", content: deployScript }),
      });

      if (!writeRes.ok) {
        const d = await writeRes.json();
        throw new Error(d.error);
      }
      addLog("Script de déploiement écrit sur le serveur ✓");
      addLog("Exécution du script via la console...");
      addLog("Note: Ouvrez l'onglet Console pour voir les logs en temps réel.");
      addLog(`Commande: bash /deploy.sh`);
      addLog("Le script a été préparé. Allez dans l'onglet Console, connectez-vous et exécutez: bash /deploy.sh");
      addLog("Done ✓");
    } catch (e: any) {
      addLog(`Erreur: ${e.message}`);
      toast({ variant: "destructive", title: "Erreur déploiement", description: e.message });
    }
    setDeploying(false);
  }

  async function uploadAndDeploy(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    addLog(`Upload de ${file.name} (${fmtSize(file.size)})...`);

    const content = await file.text();
    try {
      const res = await fetch(`/api/servers/${identifier}/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: `/${file.name}`, content }),
      });
      if (res.ok) {
        addLog(`✓ ${file.name} uploadé avec succès !`);
        toast({ title: `${file.name} uploadé` });
      } else {
        const d = await res.json();
        addLog(`Erreur: ${d.error}`);
      }
    } catch (e: any) {
      addLog(`Erreur réseau: ${e.message}`);
    }
    e.target.value = "";
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Git deploy */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-yellow-400" /> Déployer depuis Git
        </h3>
        <p className="text-xs text-zinc-500 mb-4">Clonez ou mettez à jour depuis un dépôt Git public ou privé</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">URL du dépôt</label>
            <Input
              placeholder="https://github.com/user/repo.git"
              value={gitUrl}
              onChange={e => setGitUrl(e.target.value)}
              className="bg-zinc-900 border-zinc-700 font-mono text-sm focus:border-yellow-400/50"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Branche</label>
            <Input
              placeholder="main"
              value={gitBranch}
              onChange={e => setGitBranch(e.target.value)}
              className="bg-zinc-900 border-zinc-700 font-mono text-sm focus:border-yellow-400/50 max-w-48"
            />
          </div>
          <Button
            onClick={deployFromGit}
            disabled={deploying || !gitUrl.trim()}
            className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold gap-2"
          >
            {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
            {deploying ? "Déploiement…" : "Déployer"}
          </Button>
        </div>
      </div>

      {/* Upload */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <Upload className="w-4 h-4 text-yellow-400" /> Upload de fichier
        </h3>
        <p className="text-xs text-zinc-500 mb-4">Uploadez un fichier directement sur le serveur (texte uniquement)</p>
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:border-yellow-400/30 hover:bg-zinc-800 transition-all text-sm text-zinc-400 hover:text-white flex items-center gap-2">
            <Upload className="w-4 h-4" /> Choisir un fichier
          </div>
          <input type="file" className="hidden" onChange={uploadAndDeploy} />
        </label>
      </div>

      {/* Deploy log */}
      {deployLog.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-black p-4 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
          {deployLog.map((line, i) => (
            <div key={i} className={`${line.includes("Erreur") ? "text-red-400" : line.includes("✓") ? "text-emerald-400" : "text-zinc-400"}`}>
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
  const identifier = params?.identifier || "";

  const [server, setServer] = useState<ServerInfo | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"console" | "files" | "deploy" | "settings">("console");
  const { toast } = useToast();

  async function loadServer() {
    try {
      // Find server by identifier from the list
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
    try {
      const res = await fetch(`/api/servers/${identifier}/power`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const labels = { start: "démarré", stop: "arrêté", restart: "redémarré", kill: "tué" };
        toast({ title: `Serveur ${labels[action]}` });
        setTimeout(loadStats, 2000);
      } else {
        const d = await res.json();
        toast({ variant: "destructive", title: "Erreur", description: d.error });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message });
    }
  }

  useEffect(() => {
    loadServer();
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, [identifier]);

  const memPercent = stats ? Math.round(((stats.resources?.memory_bytes || 0) / 1024 / 1024) / (server?.limits.memory || 1) * 100) : 0;
  const cpuPercent = stats ? Math.min(100, Math.round(stats.resources?.cpu_absolute || 0)) : 0;
  const diskPercent = stats ? Math.min(100, Math.round(((stats.resources?.disk_bytes || 0) / 1024 / 1024) / (server?.limits.disk || 1) * 100)) : 0;
  const isRunning = stats?.current_state === "running";

  const TABS = [
    { id: "console", label: "Console", icon: Terminal },
    { id: "files", label: "Fichiers", icon: FolderOpen },
    { id: "deploy", label: "Déployer", icon: GitBranch },
    { id: "settings", label: "Paramètres", icon: Settings },
  ] as const;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64 text-zinc-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Chargement du serveur…
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-120px)] gap-4">
        {/* Header */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Link href="/servers">
              <button className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Mes serveurs
              </button>
            </Link>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isRunning ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-zinc-600"}`} />
              <div>
                <h1 className="text-xl font-bold text-white">{server?.name || identifier}</h1>
                <div className="flex items-center gap-3 text-xs text-zinc-600 mt-0.5">
                  <span className="font-mono">{identifier}</span>
                  {server?.allocation && (
                    <span className="font-mono">{server.allocation.ip}:{server.allocation.port}</span>
                  )}
                  <span className={`font-semibold ${isRunning ? "text-emerald-400" : "text-zinc-500"}`}>
                    {stats?.current_state || "inconnu"}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats + Power actions */}
            <div className="flex items-center gap-3">
              {/* Resource bars */}
              {stats && (
                <div className="hidden sm:flex items-center gap-4 text-xs">
                  {[
                    { label: "CPU", value: cpuPercent, color: "bg-blue-400" },
                    { label: "RAM", value: memPercent, color: "bg-purple-400" },
                    { label: "Disk", value: diskPercent, color: "bg-orange-400" },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className="text-zinc-600 w-7">{r.label}</span>
                      <div className="w-16 h-1.5 rounded-full bg-zinc-800">
                        <div className={`h-full rounded-full ${r.color} transition-all`} style={{ width: `${r.value}%` }} />
                      </div>
                      <span className="text-zinc-500 w-8">{r.value}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Power actions */}
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-400 hover:bg-emerald-500/10" title="Démarrer" onClick={() => powerAction("start")}>
                  <Play className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-yellow-400 hover:bg-yellow-400/10" title="Redémarrer" onClick={() => powerAction("restart")}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-orange-400 hover:bg-orange-500/10" title="Arrêter" onClick={() => powerAction("stop")}>
                  <Square className="w-3.5 h-3.5" />
                </Button>
                <a href={`https://panel.lionelmelo.qzz.io/server/${identifier}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-500 hover:text-white" title="Panel Pterodactyl">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl border border-zinc-800 bg-zinc-900/50 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-yellow-400 text-black"
                  : "text-zinc-500 hover:text-zinc-300"
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
            <ConsolePanel identifier={identifier} serverUuid={server?.uuid || ""} />
          )}
          {activeTab === "files" && (
            <FilesPanel identifier={identifier} />
          )}
          {activeTab === "deploy" && (
            <div className="h-full overflow-y-auto">
              <DeployPanel identifier={identifier} serverName={server?.name || ""} />
            </div>
          )}
          {activeTab === "settings" && (
            <div className="space-y-5 overflow-y-auto h-full">
              {/* Resource limits */}
              {server && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-yellow-400" /> Ressources
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "RAM", value: fmtMb(server.limits.memory), icon: MemoryStick, color: "text-purple-400" },
                      { label: "Stockage", value: fmtMb(server.limits.disk), icon: HardDrive, color: "text-orange-400" },
                      { label: "CPU", value: `${server.limits.cpu}%`, icon: Cpu, color: "text-blue-400" },
                    ].map(r => (
                      <div key={r.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center">
                        <r.icon className={`w-5 h-5 mx-auto mb-2 ${r.color}`} />
                        <p className={`text-xl font-bold ${r.color}`}>{r.value}</p>
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
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "CPU", value: `${cpuPercent}%`, bar: cpuPercent, color: "bg-blue-400" },
                      { label: "RAM utilisée", value: `${Math.round((stats.resources?.memory_bytes || 0) / 1024 / 1024)} Mo`, bar: memPercent, color: "bg-purple-400" },
                      { label: "Disque utilisé", value: `${Math.round((stats.resources?.disk_bytes || 0) / 1024 / 1024)} Mo`, bar: diskPercent, color: "bg-orange-400" },
                      { label: "Réseau entrant", value: `${Math.round((stats.resources?.network_rx_bytes || 0) / 1024)} Ko`, bar: 0, color: "bg-emerald-400" },
                    ].map(r => (
                      <div key={r.label} className="space-y-2">
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

              {/* Danger zone */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/3 p-5">
                <h3 className="text-base font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Zone de danger
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    className="text-red-400 border border-red-500/30 hover:bg-red-500/10 text-sm"
                    onClick={() => powerAction("kill")}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" /> Forcer l'arrêt (kill)
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
