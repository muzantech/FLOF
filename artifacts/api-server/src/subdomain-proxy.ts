/**
 * subdomain-proxy.ts
 * Reverse proxy middleware for *.flihost.site subdomain routing.
 *
 * Architecture:
 *   Cloudflare (*.flihost.site proxied) → Express on port 8080
 *   → reads Host header → looks up subdomain → proxies to localhost:PORT
 *
 * The in-memory cache is refreshed every 30s from the DB.
 */
import http from "http";
import type { Request, Response, NextFunction, RequestHandler } from "express";
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

// Also export for direct cache update (avoid DB roundtrip on save)
export function setCacheEntry(subdomain: string, port: number, ip: string): void {
  cache.set(subdomain, { port, ip });
}
export function deleteCacheEntry(subdomain: string): void {
  cache.delete(subdomain);
}

function errorPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>${title} — FlyHost</title>
<style>*{margin:0;box-sizing:border-box}body{background:#09090b;color:#fafafa;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}
.card{background:#18181b;border:1px solid #27272a;border-radius:1rem;padding:2.5rem;max-width:440px;width:100%;text-align:center}
h1{font-size:1.5rem;color:#facc15;margin-bottom:.5rem}p{color:#a1a1aa;margin:.5rem 0}code{font-size:.8rem;color:#71717a;display:block;margin-top:1rem}
</style></head>
<body><div class="card">
<h1>⚡ FlyHost</h1>
<p>${body}</p>
</div></body></html>`;
}

export function subdomainProxyMiddleware(): RequestHandler {
  // Initial load
  refreshSubdomainCache().catch(() => {});
  setInterval(refreshSubdomainCache, 30_000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const host = (req.headers.host || "").toLowerCase();

    // Only activate for *.flihost.site (not the API itself)
    const match = host.match(/^([a-z0-9-]+)\.flihost\.site(?::\d+)?$/);
    if (!match) return next();

    const subdomain = match[1];
    if (SKIP_SUBDOMAINS.has(subdomain)) return next();

    let entry = cache.get(subdomain);
    if (!entry && cacheReady) {
      // Try a fresh DB lookup
      await refreshSubdomainCache();
      entry = cache.get(subdomain);
    }

    if (!entry) {
      res.status(404).type("html").send(errorPage(
        "Sous-domaine introuvable",
        `Le sous-domaine <strong>${subdomain}.${CF_DOMAIN}</strong> n'existe pas ou n'est pas encore configuré.`
      ));
      return;
    }

    const { port, ip } = entry;
    const targetHost = ip === "127.0.0.1" || ip === "localhost" ? "127.0.0.1" : ip;

    const options: http.RequestOptions = {
      hostname: targetHost,
      port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${targetHost}:${port}`,
        "x-forwarded-for": req.ip || req.socket.remoteAddress || "",
        "x-forwarded-host": host,
        "x-forwarded-proto": "https",
        "x-real-ip": req.ip || "",
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      // Add CORS / security headers
      headers["x-powered-by"] = "FlyHost";
      res.writeHead(proxyRes.statusCode || 200, headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", () => {
      if (!res.headersSent) {
        res.status(502).type("html").send(errorPage(
          "Serveur indisponible",
          `Le serveur <strong>${subdomain}.${CF_DOMAIN}</strong> est hors ligne ou en cours de démarrage. Réessayez dans quelques instants.`
        ));
      }
    });

    req.pipe(proxyReq, { end: true });
  };
}
