#!/usr/bin/env node
/**
 * FlyHost Reverse Proxy
 * ─────────────────────
 * Tourne dans le conteneur Pterodactyl "flyhost" (port 3000).
 * Nginx forward *.flihost.site:80 → ce conteneur:3000.
 * Le proxy lit la table de routage depuis l'API FlyHost toutes les 30s,
 * puis forward les requêtes HTTP vers le bon conteneur selon le sous-domaine.
 *
 * Variables d'environnement (configurées via Pterodactyl) :
 *   PORT          Port d'écoute (injecté par Wings, défaut 3000)
 *   API_URL       URL de l'API FlyHost pour récupérer la table de routage
 *   LOCAL_DOMAIN  Domaine à gérer (défaut: flihost.site)
 *   REFRESH_MS    Intervalle de rafraîchissement en ms (défaut: 30000)
 */

const http = require("http");
const net  = require("net");

const PROXY_PORT   = parseInt(process.env.PORT   || "3000", 10);
// API_URL: env var pris en priorité, sinon URL de l'API FlyHost sur Replit (générée lors du déploiement)
const API_URL      = (process.env.API_URL || "https://a9f3b24c-2c6e-4e8f-b135-b330026f22e3-00-3ndcmgith71am.riker.replit.dev").replace(/\/$/, "");
const LOCAL_DOMAIN = process.env.LOCAL_DOMAIN || "flihost.site";
const REFRESH_MS   = parseInt(process.env.REFRESH_MS || "30000", 10);

// In-memory routing table: subdomain → { host, port }
const routeTable = new Map();

// ─────────────────── Routing table refresh ───────────────────────────────────
async function refreshTable() {
  try {
    if (!API_URL) {
      console.error("[proxy] API_URL not set — routing table empty");
      return;
    }

    const res = await fetch(`${API_URL}/api/proxy/routes`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    routeTable.clear();
    let skipped = 0;
    for (const { subdomain, host, port } of (data.routes || [])) {
      // Skip ourselves to avoid infinite loop
      if (parseInt(port, 10) === PROXY_PORT && subdomain !== "_keep_") {
        skipped++;
        continue;
      }
      routeTable.set(subdomain.toLowerCase(), {
        host: host || "127.0.0.1",
        port: parseInt(port, 10),
      });
    }
    console.log(`[proxy] Routing table: ${routeTable.size} routes loaded (${skipped} self-excluded)`);
  } catch (err) {
    console.error(`[proxy] Table refresh failed: ${err.message}`);
  }
}

// ─────────────────── Error/landing pages ─────────────────────────────────────
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

// ─────────────────── Main proxy handler ──────────────────────────────────────
function handleRequest(clientReq, clientRes) {
  const rawHost = (clientReq.headers["host"] || "").toLowerCase();
  const host = rawHost.split(":")[0];

  const suffix = `.${LOCAL_DOMAIN}`;

  // Root domain or non-subdomain → landing page
  if (host === LOCAL_DOMAIN || !host.endsWith(suffix)) {
    sendHtml(clientRes, 200,
      `<h1>⚡ FlyHost</h1>
       <p>Hébergez vos applications en quelques secondes.</p>
       <p><a href="https://${LOCAL_DOMAIN}">Accéder au tableau de bord →</a></p>`);
    return;
  }

  const subdomain = host.slice(0, host.length - suffix.length);

  if (!subdomain) {
    sendHtml(clientRes, 200,
      `<h1>⚡ FlyHost</h1><p><a href="https://${LOCAL_DOMAIN}">Tableau de bord →</a></p>`);
    return;
  }

  const route = routeTable.get(subdomain);
  if (!route) {
    sendHtml(clientRes, 404,
      `<h1>Sous-domaine introuvable</h1>
       <p><strong>${subdomain}.${LOCAL_DOMAIN}</strong> n'est associé à aucune application.</p>
       <p>Déployez votre projet depuis le <a href="https://${LOCAL_DOMAIN}">tableau de bord FlyHost</a>.</p>
       <p><code>404 Not Found</code></p>`);
    return;
  }

  // Forward the request to the target container
  const options = {
    hostname: route.host,
    port: route.port,
    path: clientReq.url,
    method: clientReq.method,
    headers: {
      ...clientReq.headers,
      host: `${route.host}:${route.port}`,
      "x-forwarded-for": clientReq.socket.remoteAddress || "",
      "x-forwarded-host": rawHost,
      "x-real-ip": clientReq.socket.remoteAddress || "",
      "x-forwarded-proto": "https",
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
         <p>L'application <strong>${subdomain}.${LOCAL_DOMAIN}</strong> met trop de temps à répondre.</p>
         <p><code>504 Gateway Timeout</code></p>`);
    }
  });

  proxyReq.on("error", () => {
    if (!clientRes.headersSent) {
      sendHtml(clientRes, 502,
        `<h1>Application inaccessible</h1>
         <p><strong>${subdomain}.${LOCAL_DOMAIN}</strong> n'est pas démarrée ou ne répond pas (port ${route.port}).</p>
         <p>Vérifiez que votre serveur est en ligne depuis le <a href="https://${LOCAL_DOMAIN}">tableau de bord FlyHost</a>.</p>
         <p><code>502 Bad Gateway</code></p>`);
    }
  });

  clientReq.pipe(proxyReq, { end: true });
}

// ─────────────────── WebSocket passthrough ───────────────────────────────────
function handleUpgrade(req, socket, head) {
  const host = (req.headers["host"] || "").split(":")[0].toLowerCase();
  const suffix = `.${LOCAL_DOMAIN}`;
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
    if (head && head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

// ─────────────────── Boot ────────────────────────────────────────────────────
(async () => {
  console.log(`[proxy] FlyHost Reverse Proxy starting...`);
  console.log(`[proxy] Domain: *.${LOCAL_DOMAIN}`);
  console.log(`[proxy] API URL: ${API_URL || "(none)"}`);
  console.log(`[proxy] Listening on port: ${PROXY_PORT}`);

  await refreshTable();
  setInterval(refreshTable, REFRESH_MS);

  const server = http.createServer(handleRequest);
  server.on("upgrade", handleUpgrade);

  server.listen(PROXY_PORT, "0.0.0.0", () => {
    console.log(`[proxy] ✅ Ready — routing ${routeTable.size} subdomains on port ${PROXY_PORT}`);
  });

  server.on("error", (err) => {
    console.error(`[proxy] Server error: ${err.message}`);
    process.exit(1);
  });
})();
