import { Router } from "express";
import { db, serverSubdomainsTable } from "@workspace/db";

const router = Router();

/**
 * GET /api/proxy/routes
 * Returns the full subdomain → port/host routing table.
 * Used by the VPS proxy container to refresh its in-memory routing table.
 * This endpoint is intentionally PUBLIC — it only exposes port numbers, not secrets.
 */
router.get("/proxy/routes", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(serverSubdomainsTable);
    const routes = rows.map((r) => ({
      subdomain: r.subdomain,
      host: r.ip || "127.0.0.1",
      port: r.port,
    }));
    res.json({ routes, total: routes.length, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
