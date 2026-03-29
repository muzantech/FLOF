/**
 * subdomain-proxy.ts
 * Reverse proxy handler for *.flihost.site subdomain routing.
 *
 * Architecture:
 *   Cloudflare (*.flihost.site proxied) → proxy server on PROXY_PORT
 *   → reads Host header → looks up subdomain → proxies to TARGET_IP:PORT
 *
 * Uses only plain Node.js http methods — works in BOTH:
 *   - Express middleware context
 *   - Standalone http.createServer context
 */
import http from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { db, serverSubdomainsTable } from "@workspace/db";

const CF_DOMAIN = "flihost.site";
const SKIP_SUBDOMAINS = new Set(["api", "panel", "www", "admin", "mail", "smtp"]);

interface SubdomainEntry { port: number; ip: string }
const cache = new Map<string, SubdomainEntry>();
let cacheReady = false;

export async function refreshSubdomainCache(): Promise<void> {
  try {
    const rows = await db.select().from(serverSubdomainsTable);
    cache.clear();
    for (const r of rows) cache.set(r.subdomain, { port: r.port, ip: r.ip });
    cacheReady = true;
    console.log(`[subdomain-proxy] cache refreshed — ${cache.size} entries`);
  } catch (e) {
    console.error("[subdomain-proxy] cache refresh error:", e);
  }
}

export function setCacheEntry(subdomain: string, port: number, ip: string): void {
  cache.set(subdomain, { port, ip });
}
export function deleteCacheEntry(subdomain: string): void {
  cache.delete(subdomain);
}

function errorPage(statusCode: number, title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${title} — FlyHost</title>
<style>*{margin:0;box-sizing:border-box}body{background:#09090b;color:#fafafa;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
.card{background:#18181b;border:1px solid #27272a;border-radius:1rem;padding:2.5rem;max-width:440px;width:100%;text-align:center}
h1{font-size:1.5rem;color:#facc15;margin-bottom:.5rem}p{color:#a1a1aa;margin:.5rem 0}
.badge{display:inline-block;margin-top:1rem;padding:.25rem .75rem;border-radius:9999px;background:#27272a;color:#71717a;font-size:.75rem;font-family:monospace}
</style></head>
<body><div class="card">
<h1>⚡ FlyHost</h1>
<p>${body}</p>
<span class="badge">${statusCode} — ${title}</span>
</div></body></html>`;
}

function sendHtml(res: ServerResponse, statusCode: number, html: string): void {
  const buf = Buffer.from(html, "utf-8");
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": buf.length,
    "Cache-Control": "no-cache",
  });
  res.end(buf);
}

/**
 * Core proxy handler — works with plain Node.js IncomingMessage/ServerResponse.
 * Pass next = undefined for standalone server (not Express).
 * Pass next = express next function for middleware mode.
 */
export async function handleSubdomainProxy(
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void
): Promise<void> {
  const host = ((req.headers.host) || "").toLowerCase();

  // Only activate for *.flihost.site
  const match = host.match(/^([a-z0-9-]+)\.flihost\.site(?::\d+)?$/);
  if (!match) {
    if (next) next();
    return;
  }

  const subdomain = match[1];
  if (SKIP_SUBDOMAINS.has(subdomain)) {
    if (next) next();
    return;
  }

  let entry = cache.get(subdomain);
  if (!entry && cacheReady) {
    await refreshSubdomainCache();
    entry = cache.get(subdomain);
  }

  if (!entry) {
    sendHtml(res, 404, errorPage(
      404,
      "Sous-domaine introuvable",
      `Le sous-domaine <strong>${subdomain}.${CF_DOMAIN}</strong> n'existe pas ou n'est pas encore configuré.`
    ));
    return;
  }

  const { port, ip } = entry;

  const remoteAddr = req.socket?.remoteAddress || "";
  const options: http.RequestOptions = {
    hostname: ip,
    port,
    path: req.url || "/",
    method: req.method || "GET",
    headers: {
      ...req.headers,
      host: `${ip}:${port}`,
      "x-forwarded-for": remoteAddr,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
      "x-real-ip": remoteAddr,
    },
    timeout: 30_000,
  };

  // Remove transfer-encoding to avoid conflicts
  delete (options.headers as any)["transfer-encoding"];

  const proxyReq = http.request(options, (proxyRes) => {
    if (res.headersSent) return;
    const headers = { ...proxyRes.headers, "x-powered-by": "FlyHost" };
    res.writeHead(proxyRes.statusCode || 200, headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("timeout", () => {
    proxyReq.destroy();
    if (!res.headersSent) {
      sendHtml(res, 504, errorPage(
        504,
        "Délai dépassé",
        `Le serveur <strong>${subdomain}.${CF_DOMAIN}</strong> met trop de temps à répondre.`
      ));
    }
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      sendHtml(res, 502, errorPage(
        502,
        "Serveur indisponible",
        `Le serveur <strong>${subdomain}.${CF_DOMAIN}</strong> est hors ligne ou en cours de démarrage.<br>Réessayez dans quelques instants.`
      ));
    }
  });

  req.pipe(proxyReq, { end: true });
}

/**
 * Express middleware wrapper.
 * Must be placed BEFORE express.json() body parser so the body stream is intact.
 */
export function subdomainProxyMiddleware() {
  // Initial load + periodic refresh
  refreshSubdomainCache().catch(() => {});
  setInterval(refreshSubdomainCache, 30_000);

  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    handleSubdomainProxy(req, res, next).catch((err) => {
      console.error("[subdomain-proxy] unhandled error:", err);
      next();
    });
  };
}
