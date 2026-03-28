import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { pteroClientRequest } from "./pterodactyl";
import jwt from "jsonwebtoken";
import { startCronJobs } from "./cron";
import { ensureWildcardDNS } from "./cloudflare";

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

// Start the server
server.listen(port, async (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  // Boot tasks (non-blocking)
  ensureWildcardDNS().catch(e => logger.warn({ e }, "ensureWildcardDNS failed"));
  startCronJobs();
});
