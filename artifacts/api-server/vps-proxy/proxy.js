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
 *  4. POST /api/payment/mf-relay → relais MoneyFusion depuis IP VPS autorisée
 *
 * Variables d'environnement :
 *   PORT             Port d'écoute (injecté par Wings, défaut 3000)
 *   API_URL          URL de l'API FlyHost pour les routes + forward API (défaut hardcodé)
 *   LOCAL_DOMAIN     Domaine à gérer (défaut: flihost.site)
 *   REFRESH_MS       Intervalle de rafraîchissement de la table de routage (défaut: 30000)
 *   MF_RELAY_SECRET  Secret partagé pour sécuriser le relais MoneyFusion
 *   MF_PAY_URL       URL de l'API MoneyFusion
 */

const http   = require("http");
const https  = require("https");
const net    = require("net");
const tls    = require("tls");
const fs     = require("fs");
const path   = require("path");
const url    = require("url");

const PROXY_PORT   = parseInt(process.env.PORT   || "3000", 10);
const API_URL = (process.env.API_URL || "https://e45e8016-d33b-437f-b68f-eaf0f042e9f9-00-1nanj8yfver6c.spock.replit.dev").replace(/\/$/, "");
const LOCAL_DOMAIN = process.env.LOCAL_DOMAIN || "flihost.site";
const REFRESH_MS   = parseInt(process.env.REFRESH_MS || "30000", 10);
const MF_RELAY_SECRET = process.env.MF_RELAY_SECRET || "flyhost-mf-relay-2026-secret";
const MF_PAY_URL = process.env.MF_PAY_URL || "https://www.pay.moneyfusion.net/FLYHOST/8a106a9cd82c8779/pay/";

/**
 * Detect the Docker host gateway IP by reading /proc/net/route.
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

const HOST_GATEWAY = process.env.HOST_IP || process.env.SERVER_IP || "173.212.226.118" || detectHostGateway();

const STATIC_DIR = path.join(__dirname, "public");
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
        host: HOST_GATEWAY,
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
function serveStatic(reqPath, clientRes) {
  let filePath = path.join(STATIC_DIR, reqPath === "/" ? "index.html" : reqPath);
  if (!filePath.startsWith(STATIC_DIR)) {
    clientRes.writeHead(403); clientRes.end(); return;
  }
  if (!fs.existsSync(filePath) && !path.extname(reqPath)) {
    filePath = path.join(STATIC_DIR, "index.html");
  }
  if (!fs.existsSync(filePath)) {
    clientRes.writeHead(404, { "Content-Type": "text/plain" });
    clientRes.end("404 Not Found");
    return;
  }
  const stat = fs.statSync(filePath);
  const mime = getMime(filePath);
  clientRes.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
    "Cache-Control": filePath.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Powered-By": "FlyHost",
  });
  fs.createReadStream(filePath).pipe(clientRes);
}

// ─────────────────── MoneyFusion relay (appel depuis IP VPS autorisée) ────────
async function handleMfRelay(clientReq, clientRes) {
  let body = "";
  clientReq.on("data", chunk => { body += chunk; });
  clientReq.on("end", async () => {
    try {
      // CORS headers
      clientRes.setHeader("Access-Control-Allow-Origin", "*");

      const data = JSON.parse(body);
      const { secret, payload } = data;

      if (secret !== MF_RELAY_SECRET) {
        clientRes.writeHead(403, { "Content-Type": "application/json" });
        clientRes.end(JSON.stringify({ error: "Unauthorized relay" }));
        return;
      }

      console.log(`[mf-relay] Calling MoneyFusion for order: ${payload?.numeroOrdre}`);

      // Call MoneyFusion FROM this VPS (IP 173.212.226.118 — whitelisted)
      const mfRes = await fetch(MF_PAY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });

      const mfText = await mfRes.text();
      let mfData;
      try { mfData = JSON.parse(mfText); } catch { mfData = { error: mfText }; }

      console.log(`[mf-relay] MoneyFusion response (${mfRes.status}):`, JSON.stringify(mfData).substring(0, 200));

      clientRes.writeHead(200, { "Content-Type": "application/json" });
      clientRes.end(JSON.stringify({ status: mfRes.status, data: mfData }));
    } catch (err) {
      console.error(`[mf-relay] Error: ${err.message}`);
      clientRes.writeHead(500, { "Content-Type": "application/json" });
      clientRes.end(JSON.stringify({ error: err.message }));
    }
  });
  clientReq.on("error", (err) => {
    clientRes.writeHead(500, { "Content-Type": "application/json" });
    clientRes.end(JSON.stringify({ error: err.message }));
  });
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

  // ── Root domain ───────────────────────────────────────────────────────────
  if (host === LOCAL_DOMAIN || !host.endsWith(suffix)) {

    // CORS preflight
    if (clientReq.method === "OPTIONS") {
      clientRes.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      });
      clientRes.end();
      return;
    }

    // MoneyFusion relay — handled locally on VPS (whitelisted IP)
    if (reqPath === "/api/payment/mf-relay" && clientReq.method === "POST") {
      handleMfRelay(clientReq, clientRes);
      return;
    }

    // Other API calls → forward to Replit
    if (reqPath.startsWith("/api/")) {
      proxyToApi(clientReq, clientRes);
      return;
    }

    serveStatic(url.parse(reqPath).pathname, clientRes);
    return;
  }

  // ── Subdomains ────────────────────────────────────────────────────────────
  const subdomain = host.slice(0, host.length - suffix.length);
  if (!subdomain) { serveStatic("/", clientRes); return; }

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

  if ((host === LOCAL_DOMAIN || !host.endsWith(suffix)) && reqPath.startsWith("/api/")) {
    const apiHost = API_URL.replace(/^https?:\/\//, "");
    const upstream = tls.connect({ host: apiHost, port: 443, servername: apiHost }, () => {
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
  console.log(`[FlyHost] MF URL  : ${MF_PAY_URL}`);

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
