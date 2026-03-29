import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db, announcementsTable } from "@workspace/db";
import { eq, and, or, isNull, gt } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/announcements — public active announcements
router.get("/announcements", async (_req, res): Promise<void> => {
  const now = new Date();
  const rows = await db.select().from(announcementsTable)
    .where(and(
      eq(announcementsTable.active, true),
      or(isNull(announcementsTable.expiresAt), gt(announcementsTable.expiresAt, now))
    ));
  res.json({ announcements: rows });
});

// POST /api/admin/announcements — créer une annonce (admin)
router.post("/admin/announcements", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const user = (req as any).userRow;
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }
  const { title, message, type = "info", expiresAt } = req.body;
  if (!title || !message) { res.status(400).json({ error: "title et message requis" }); return; }
  const [row] = await db.insert(announcementsTable).values({
    title, message, type,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();
  res.status(201).json({ announcement: row });
});

// DELETE /api/admin/announcements/:id — supprimer (admin)
router.delete("/admin/announcements/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const user = (req as any).userRow;
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }
  await db.delete(announcementsTable).where(eq(announcementsTable.id, parseInt(req.params.id as string)));
  res.json({ ok: true });
});

// PATCH /api/admin/announcements/:id — activer/désactiver
router.patch("/admin/announcements/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const user = (req as any).userRow;
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    res.status(403).json({ error: "Accès refusé" });
    return;
  }
  const { active, title, message, type } = req.body;
  const [row] = await db.update(announcementsTable)
    .set({ ...(active !== undefined && { active }), ...(title && { title }), ...(message && { message }), ...(type && { type }) })
    .where(eq(announcementsTable.id, parseInt(req.params.id as string)))
    .returning();
  res.json({ announcement: row });
});

export default router;
