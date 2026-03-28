import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { restartSchedulesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/servers/:id/schedules
router.post("/servers/:id/schedules", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { frequency = "daily", hour = 4, minute = 0 } = req.body;
    if (!["hourly", "daily", "weekly"].includes(frequency)) { res.status(400).json({ error: "Fréquence invalide" }); return; }
    if (hour < 0 || hour > 23) { res.status(400).json({ error: "Heure invalide (0-23)" }); return; }
    if (minute < 0 || minute > 59) { res.status(400).json({ error: "Minute invalide (0-59)" }); return; }

    const [schedule] = await db.insert(restartSchedulesTable).values({
      serverId: req.params.id,
      userId: req.userId!,
      frequency,
      hour,
      minute,
      enabled: 1,
    }).returning();

    res.status(201).json({ schedule });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/servers/:id/schedules
router.get("/servers/:id/schedules", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const schedules = await db.select().from(restartSchedulesTable)
      .where(and(eq(restartSchedulesTable.serverId, req.params.id), eq(restartSchedulesTable.userId, req.userId!)));
    res.json({ schedules });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/servers/:id/schedules/:scheduleId
router.put("/servers/:id/schedules/:scheduleId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);
    const { frequency, hour, minute, enabled } = req.body;

    const update: any = {};
    if (frequency !== undefined) update.frequency = frequency;
    if (hour !== undefined) update.hour = hour;
    if (minute !== undefined) update.minute = minute;
    if (enabled !== undefined) update.enabled = enabled ? 1 : 0;

    await db.update(restartSchedulesTable)
      .set(update)
      .where(and(eq(restartSchedulesTable.id, scheduleId), eq(restartSchedulesTable.userId, req.userId!)));

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/servers/:id/schedules/:scheduleId
router.delete("/servers/:id/schedules/:scheduleId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);
    await db.delete(restartSchedulesTable)
      .where(and(eq(restartSchedulesTable.id, scheduleId), eq(restartSchedulesTable.userId, req.userId!)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
