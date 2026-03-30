import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import os from "os";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const start = Date.now();
  let dbStatus = "ok";
  let dbLatencyMs = 0;

  try {
    await pool.query("SELECT 1");
    dbLatencyMs = Date.now() - start;
  } catch {
    dbStatus = "error";
  }

  const memTotal = os.totalmem();
  const memFree = os.freemem();
  const memUsedPct = Math.round(((memTotal - memFree) / memTotal) * 100);

  const data = HealthCheckResponse.parse({ status: dbStatus === "ok" ? "ok" : "degraded" });
  res.status(dbStatus === "ok" ? 200 : 503).json({
    ...data,
    db: { status: dbStatus, latencyMs: dbLatencyMs },
    uptime: Math.round(process.uptime()),
    memory: { usedPct: memUsedPct },
    timestamp: new Date().toISOString(),
  });
});

export default router;
