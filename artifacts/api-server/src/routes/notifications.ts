import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/notifications
router.get("/notifications", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const items = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);
    const unreadCount = items.filter(n => !n.read).length;
    res.json({ notifications: items, unreadCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/read
router.post("/notifications/:id/read", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.userId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all
router.post("/notifications/read-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, req.userId!));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

// Helper: create a notification in DB
export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  metadata?: object,
): Promise<void> {
  try {
    await db.insert(notificationsTable).values({ userId, type, title, message, metadata });
  } catch (err) {
    console.error("[notifications] Failed to insert:", err);
  }
}
