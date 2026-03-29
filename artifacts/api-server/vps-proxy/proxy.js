#!/usr/bin/env node
/**
 * FlyHost Complete Proxy
 * ──────────────────────
 * Tourne dans le conteneur Pterodactyl "flyhost" (port 3000).
 * Cloudflare / Nginx forward tout *.flihost.site:443 → ce conteneur:3000.
 *
 * Ce proxy gère :
 *  1. flihost.site  → sert les fichiers statiques du dashboard React (dossier ./public/)
 *  2. flihost.site/api/*  → forward vers l'API FlyHost (Replit)
 *  3. *.flihost.site  → forward vers le container Pterodactyl correspondant
 *
 * Variables d'environnement :
 *   PORT         Port d'écoute (injecté par Wings, défaut 3000)
 *   API_URL      URL de l'API FlyHost pour les routes + forward API (défaut hardcodé)
 *   LOCAL_DOMAIN Domaine à gérer (défaut: flihost.site)
 *   REFRESH_MS   Intervalle de rafraîchissement de la table de routage (défaut: 30000)
 */

const http   = require("http");
const https  = require("https");
const net    = require("net");
const fs     = require("fs");
const path   = require("path");
const url    = require("url");

const PROXY_PORT   = parseInt(process.env.PORT   || "3000", 10);
const API_URL      = (process.env.API_URL || "https://a9f3b24c-2c6e-4e8f-b135-b330026f22e3-00-3ndcmgith71am.riker.replit.dev").replace(/\/$/, "");
const LOCAL_DOMAIN = process.env.LOCAL_DOMAIN || "flihost.site";
const REFRESH_MS   = parseInt(process.env.REFRESH_MS || "30000", 10);

/**
 * Detect the Docker host gateway IP by reading /proc/net/route.
 * Inside a Pterodactyl container, 127.0.0.1 is the container itself — NOT the host.
 * The other containers are reachable via the Docker bridge gateway (e.g. 172.18.0.1).
 * Falls back to 127.0.0.1 if running outside Docker (e.g. dev with host networking).
 */
function detectHostGateway() {
  try {
    const routes = fs.readFileSync("/proc/net/route", "utf8");
    for (const line of routes.split("\n").slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (!parts[1] || !parts[2]) continue;
      if (parts[1] === "00000000" && parts[2] !== "00000000") {
        const hex = parts[2];
        const ip = [
          parseInt(hex.slice(6, 8), 16),
          parseInt(hex.slice(4, 6), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(0, 2), 16),
        ].join(".");
        return ip;
      }
    }
  } catch (_) {}
  return "127.0.0.1";
}

// HOST_IP: IP where the other Pterodactyl containers are reachable.
// Docker-proxy binds to the VPS external IP (173.212.226.118), NOT to 127.0.0.1 or the Docker gateway.
// UFW is configured to allow traffic from pterodactyl_nw (172.18.0.0/16) to this IP on ports 3001-3199.
// Priority: HOST_IP env > SERVER_IP env > detected Docker gateway (fallback)
const HOST_GATEWAY = process.env.HOST_IP || process.env.SERVER_IP || "173.212.226.118" || detectHostGateway();

// Dossier des fichiers statiques du dashboard (déployé avec le proxy)
const STATIC_DIR = path.join(__dirname, "public");

// In-memory routing table: subdomain → { host, port }
const routeTable = new Map();

// ─────────────────── MIME types ──────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico":  "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".json": "application/json",
  ".txt":  "text/plain",
};

function getMime(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

// ─────────────────── Routing table refresh ───────────────────────────────────
async function refreshTable() {
  try {
    const res = await fetch(`${API_URL}/api/proxy/routes`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    routeTable.clear();
    let skipped = 0;
    for (const { subdomain, port } of (data.routes || [])) {
      if (parseInt(port, 10) === PROXY_PORT) { skipped++; continue; }
      routeTable.set(subdomain.toLowerCase(), {
        host: HOST_GATEWAY,   // Route via Docker gateway to reach other containers on the host
        port: parseInt(port, 10),
      });
    }
    console.log(`[proxy] Table: ${routeTable.size} routes via ${HOST_GATEWAY} (${skipped} self-excluded)`);
  } catch (err) {
    console.error(`[proxy] Table refresh failed: ${err.message}`);
  }
}

// ─────────────────── Error pages ─────────────────────────────────────────────
function sendHtml(res, status, body) {
  const html = `<!DOCTYPE html><html lang="fr">
<head><meta charset="utf-8"><title>FlyHost</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
.card{background:#18181b;border:1px solid #27272a;border-radius:1rem;padding:2.5rem;text-align:center;max-width:520px;width:100%}
h1{font-size:1.6rem;margin-bottom:.75rem;color:#facc15}p{color:#a1a1aa;line-height:1.6;margin:.5rem 0}
a{color:#facc15}code{background:#09090b;color:#71717a;padding:.2rem .6rem;border-radius:.3rem;font-size:.85rem}</style>
</head><body><div class="card">${body}</div></body></html>`;
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "X-Powered-By": "FlyHost",
  });
  res.end(html);
}

// ─────────────────── Static file server (dashboard) ──────────────────────────
// Checks ./public/ first; if missing, falls back to the Replit API server
// which also serves the built frontend (no VPS file push needed after rebuilds).
const STATIC_AVAILABLE = fs.existsSync(STATIC_DIR);

function serveStatic(reqPath, clientReq, clientRes) {
  // ── 1. Try local ./public/ if it exists ──────────────────────────────────
  if (STATIC_AVAILABLE) {
    let filePath = path.join(STATIC_DIR, reqPath === "/" ? "index.html" : reqPath);
    if (!filePath.startsWith(STATIC_DIR)) { clientRes.writeHead(403); clientRes.end(); return; }
    if (!fs.existsSync(filePath) && !path.extname(reqPath)) {
      filePath = path.join(STATIC_DIR, "index.html");
    }
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const mime = getMime(filePath);
      clientRes.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": stat.size,
        "Cache-Control": filePath.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
        "X-Powered-By": "FlyHost",
      });
      fs.createReadStream(filePath).pipe(clientRes);
      return;
    }
  }

  // ── 2. Fallback: forward to Replit API server which hosts the frontend ───
  proxyToApi(clientReq, clientRes);
}

// ─────────────────── API proxy (forward to Replit API) ───────────────────────
function proxyToApi(clientReq, clientRes) {
  const apiHost    = API_URL.replace(/^https?:\/\//, "");
  const isHttps    = API_URL.startsWith("https");
  const transport  = isHttps ? https : http;
  const apiPort    = isHttps ? 443 : 80;

  const options = {
    hostname: apiHost,
    port: apiPort,
    path: clientReq.url,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      host: apiHost,
    },
    timeout: 30_000,
  };

  const proxyReq = transport.request(options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error(`[proxy] API forward error: ${err.message}`);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { "Content-Type": "text/plain" });
      clientRes.end("502 Bad Gateway (API)");
    }
  });

  clientReq.pipe(proxyReq, { end: true });
}

// ─────────────────── Subdomain proxy ─────────────────────────────────────────
function proxyToContainer(subdomain, route, clientReq, clientRes) {
  // First probe TCP connectivity with a short timeout (5s) to fail fast
  // instead of hanging until Cloudflare's timeout (which would cause a 504)
  const probe = net.createConnection({ host: route.host, port: route.port });
  probe.setTimeout(5_000);

  const fail502 = () => {
    probe.destroy();
    if (!clientRes.headersSent) {
      sendHtml(clientRes, 502,
        `<h1>Application hors ligne</h1>
         <p><strong>${subdomain}.${LOCAL_DOMAIN}</strong> n'est pas démarrée ou ne répond pas.</p>
         <p>Démarrez votre serveur depuis le <a href="https://${LOCAL_DOMAIN}">tableau de bord FlyHost</a>.</p>
         <p><code>502 Bad Gateway</code></p>`);
    }
  };

  probe.on("timeout", fail502);
  probe.on("error", fail502);

  probe.on("connect", () => {
    // Connection works — destroy probe and do the real proxy request
    probe.destroy();

    const options = {
      hostname: route.host,
      port: route.port,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: `${route.host}:${route.port}`,
        "x-forwarded-for": clientReq.socket.remoteAddress || "",
        "x-forwarded-host": clientReq.headers.host || "",
        "x-forwarded-proto": "https",
        "x-real-ip": clientReq.socket.remoteAddress || "",
      },
      timeout: 30_000,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers, "x-powered-by": "FlyHost" };
      clientRes.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(clientRes, { end: true });
    });

    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      if (!clientRes.headersSent) {
        sendHtml(clientRes, 504,
          `<h1>Délai dépassé</h1>
           <p>L'app <strong>${subdomain}.${LOCAL_DOMAIN}</strong> ne répond pas dans le délai imparti.</p>
           <p><code>504 Gateway Timeout</code></p>`);
      }
    });

    proxyReq.on("error", (err) => {
      if (!clientRes.headersSent) {
        sendHtml(clientRes, 502,
          `<h1>Erreur de connexion</h1>
           <p><strong>${subdomain}.${LOCAL_DOMAIN}</strong> : ${err.message}</p>
           <p><code>502 Bad Gateway</code></p>`);
      }
    });

    clientReq.pipe(proxyReq, { end: true });
  });
}

// ─────────────────── Main handler ────────────────────────────────────────────
function handleRequest(clientReq, clientRes) {
  const rawHost = (clientReq.headers["host"] || "").toLowerCase();
  const host    = rawHost.split(":")[0];
  const suffix  = `.${LOCAL_DOMAIN}`;
  const reqPath = clientReq.url || "/";

  // ── Root domain: serve dashboard OR forward API calls ───────────────────
  if (host === LOCAL_DOMAIN || !host.endsWith(suffix)) {
    if (reqPath.startsWith("/api/")) {
      proxyToApi(clientReq, clientRes);
    } else {
      serveStatic(url.parse(reqPath).pathname, clientReq, clientRes);
    }
    return;
  }

  // ── Subdomains ────────────────────────────────────────────────────────────
  const subdomain = host.slice(0, host.length - suffix.length);
  if (!subdomain) { serveStatic("/", clientReq, clientRes); return; }

  const route = routeTable.get(subdomain);
  if (!route) {
    sendHtml(clientRes, 404,
      `<h1>Sous-domaine introuvable</h1>
       <p><strong>${subdomain}.${LOCAL_DOMAIN}</strong> n'est associé à aucune application.</p>
       <p>Déployez votre projet depuis le <a href="https://${LOCAL_DOMAIN}">tableau de bord FlyHost</a>.</p>
       <p><code>404 Not Found</code></p>`);
    return;
  }

  proxyToContainer(subdomain, route, clientReq, clientRes);
}

// ─────────────────── WebSocket passthrough ───────────────────────────────────
function handleUpgrade(req, socket, head) {
  const host    = (req.headers["host"] || "").split(":")[0].toLowerCase();
  const suffix  = `.${LOCAL_DOMAIN}`;
  const reqPath = req.url || "/";

  // API WebSocket → forward to Replit
  if ((host === LOCAL_DOMAIN || !host.endsWith(suffix)) && reqPath.startsWith("/api/")) {
    const apiHost = API_URL.replace(/^https?:\/\//, "");
    const upstream = net.connect(443, apiHost, () => {
      upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n`);
      for (const [k, v] of Object.entries(req.headers)) {
        upstream.write(`${k}: ${v}\r\n`);
      }
      upstream.write("\r\n");
      if (head?.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    return;
  }

  if (!host.endsWith(suffix)) { socket.destroy(); return; }
  const subdomain = host.slice(0, host.length - suffix.length);
  const route = routeTable.get(subdomain);
  if (!route) { socket.destroy(); return; }

  const upstream = net.connect(route.port, route.host, () => {
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n`);
    for (const [k, v] of Object.entries(req.headers)) {
      upstream.write(`${k}: ${v}\r\n`);
    }
    upstream.write("\r\n");
    if (head?.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

// ─────────────────── Boot ────────────────────────────────────────────────────
(async () => {
  console.log(`[FlyHost] Starting complete proxy...`);
  console.log(`[FlyHost] Domain  : *.${LOCAL_DOMAIN}`);
  console.log(`[FlyHost] API URL : ${API_URL}`);
  console.log(`[FlyHost] Static  : ${STATIC_DIR} (exists: ${fs.existsSync(STATIC_DIR)})`);
  console.log(`[FlyHost] Port    : ${PROXY_PORT}`);

  await refreshTable();
  setInterval(refreshTable, REFRESH_MS);

  const server = http.createServer(handleRequest);
  server.on("upgrade", handleUpgrade);
  server.listen(PROXY_PORT, "0.0.0.0", () => {
    console.log(`[FlyHost] ✅ Ready — ${routeTable.size} subdomains — port ${PROXY_PORT}`);
  });
  server.on("error", (err) => {
    console.error(`[FlyHost] Server error: ${err.message}`);
    process.exit(1);
  });
})();
