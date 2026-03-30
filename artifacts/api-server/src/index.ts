import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { pteroClientRequest } from "./pterodactyl";
import jwt from "jsonwebtoken";
import { startCronJobs } from "./cron";
import { startBackupCron } from "./backup";
import { ensureWildcardDNS } from "./cloudflare";
import { subdomainProxyMiddleware, handleSubdomainProxy } from "./subdomain-proxy";
import { syncAllSubdomains } from "./routes/servers";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const JWT_SECRET = process.env.SESSION_SECRET || "flyhost-secret-key-change-in-production";

// Create an HTTP server wrapping Express
const server = http.createServer(app);

// Attach WebSocket server (handles upgrades for /api/ws/*)
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://localhost:${port}`);

  // Only handle /api/ws/servers/:identifier
  const match = url.pathname.match(/^\/api\/ws\/servers\/([a-f0-9-]+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const identifier = match[1];

  // Auth check — token in query string
  const token = url.searchParams.get("token");
  if (!token) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }

  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, identifier);
  });
});

// WebSocket proxy handler
wss.on("connection", async (clientWs: WebSocket, _request: http.IncomingMessage, identifier: string) => {
  let pteroWs: WebSocket | null = null;

  function send(ws: WebSocket, data: object) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  async function connectToPtero() {
    try {
      // Get fresh console token from Pterodactyl
      const data = await pteroClientRequest(`/servers/${identifier}/websocket`);
      const { socket: wsUrl, token: wsToken } = data.data;

      pteroWs = new WebSocket(wsUrl, {
        headers: { Origin: process.env.PTERODACTYL_URL || "" },
      });

      pteroWs.on("open", () => {
        // Authenticate with Pterodactyl
        pteroWs!.send(JSON.stringify({ event: "auth", args: [wsToken] }));
      });

      pteroWs.on("message", (data) => {
        // Forward Pterodactyl messages to client
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data.toString());
        }
      });

      pteroWs.on("error", (err) => {
        send(clientWs, {
          event: "flyhost_error",
          args: [`WebSocket Pterodactyl: ${err.message}`],
        });
      });

      pteroWs.on("close", () => {
        send(clientWs, { event: "flyhost_disconnected", args: [] });
      });

      // Handle token refresh
      pteroWs.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.event === "token expiring" || msg.event === "token expired") {
            refreshToken();
          }
        } catch {}
      });
    } catch (err: any) {
      send(clientWs, {
        event: "flyhost_error",
        args: [`Impossible de se connecter: ${err.message}`],
      });
    }
  }

  async function refreshToken() {
    try {
      const data = await pteroClientRequest(`/servers/${identifier}/websocket`);
      const { token: newToken } = data.data;
      if (pteroWs?.readyState === WebSocket.OPEN) {
        pteroWs.send(JSON.stringify({ event: "auth", args: [newToken] }));
      }
    } catch {}
  }

  // Forward commands from client to Pterodactyl
  clientWs.on("message", (data) => {
    if (pteroWs?.readyState === WebSocket.OPEN) {
      pteroWs.send(data.toString());
    }
  });

  clientWs.on("close", () => {
    pteroWs?.close();
  });

  // Start connection
  await connectToPtero();
});

// Start the API server
server.listen(port, async (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "API Server listening");

  // Boot tasks (non-blocking)
  ensureWildcardDNS().catch(e => logger.warn({ e }, "ensureWildcardDNS failed"));
  startCronJobs();
  startBackupCron();
  // Populate subdomain → port mapping from all existing Pterodactyl servers
  syncAllSubdomains().catch(e => logger.warn({ e }, "syncAllSubdomains failed"));
});

// ─── Standalone Subdomain Reverse Proxy ───────────────────────────────────────
// Listens on PROXY_PORT (default 3000) and routes *.flihost.site → localhost:PORT
// In production: set PROXY_PORT=80 so Cloudflare proxied traffic hits this server.
// Architecture: Cloudflare (proxied) → this server → localhost:{container_port}
const proxyPort = parseInt(process.env["PROXY_PORT"] || "3000", 10);

const LANDING_HTML = Buffer.from(`<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>FlyHost</title>
<style>*{margin:0;box-sizing:border-box}body{background:#09090b;color:#fafafa;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}
.card{background:#18181b;border:1px solid #27272a;border-radius:1rem;padding:2.5rem;max-width:440px;width:100%;text-align:center}
h1{font-size:2rem;color:#facc15;margin-bottom:1rem}p{color:#a1a1aa}a{color:#facc15;text-decoration:none}
</style></head>
<body><div class="card">
<h1>⚡ FlyHost</h1>
<p>Bienvenue sur FlyHost — Hébergez vos apps en un clic.</p>
<p style="margin-top:1rem"><a href="https://flyhost.flihost.site">Accéder à la plateforme →</a></p>
</div></body></html>`, "utf-8");

const proxyServer = http.createServer((req, res) => {
  handleSubdomainProxy(req, res, () => {
    // Not a subdomain request — show landing page
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": LANDING_HTML.length,
    });
    res.end(LANDING_HTML);
  }).catch(() => {
    res.writeHead(500);
    res.end("Internal error");
  });
});

proxyServer.listen(proxyPort, () => {
  logger.info({ proxyPort }, "Subdomain proxy server listening");
});
