import { Router, type IRouter } from "express";
import { db, domainsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.delete("/domains/:domainId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.domainId) ? req.params.domainId[0] : req.params.domainId;
  const domainId = parseInt(raw, 10);
  
  await db.delete(domainsTable).where(eq(domainsTable.id, domainId));
  res.sendStatus(204);
});

router.post("/domains/:domainId/verify", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.domainId) ? req.params.domainId[0] : req.params.domainId;
  const domainId = parseInt(raw, 10);
  
  // Simulate DNS verification (random success for demo)
  const verified = Math.random() > 0.3;
  
  const [domain] = await db.update(domainsTable)
    .set({ verified })
    .where(eq(domainsTable.id, domainId))
    .returning();
  
  if (!domain) {
    res.status(404).json({ error: "Domain not found" });
    return;
  }
  
  res.json(domain);
});

export default router;
