import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";

const router: IRouter = Router();

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// POST /api/keys/create
router.post("/keys/create", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { name, permissions = "read", webhookUrl, telegramChatId, whatsappNumber } = req.body;
    if (!name) { res.status(400).json({ error: "Nom requis" }); return; }

    const existing = await db.select().from(apiKeysTable).where(eq(apiKeysTable.userId, req.userId!));
    if (existing.length >= 5) { res.status(400).json({ error: "Maximum 5 clés API par compte" }); return; }

    const rawKey = `fh_${randomBytes(32).toString("hex")}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10);

    await db.insert(apiKeysTable).values({
      userId: req.userId!,
      keyHash,
      keyPrefix,
      name,
      permissions,
      webhookUrl,
      telegramChatId,
      whatsappNumber,
    });

    // Return raw key ONCE — it cannot be retrieved later
    res.status(201).json({ key: rawKey, prefix: keyPrefix, name, permissions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/keys
router.get("/keys", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const keys = await db.select({
      id: apiKeysTable.id,
      keyPrefix: apiKeysTable.keyPrefix,
      name: apiKeysTable.name,
      permissions: apiKeysTable.permissions,
      webhookUrl: apiKeysTable.webhookUrl,
      telegramChatId: apiKeysTable.telegramChatId,
      lastUsedAt: apiKeysTable.lastUsedAt,
      createdAt: apiKeysTable.createdAt,
    }).from(apiKeysTable).where(eq(apiKeysTable.userId, req.userId!));
    res.json({ keys });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/keys/:id
router.delete("/keys/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [key] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id)).limit(1);
    if (!key || key.userId !== req.userId!) { res.status(404).json({ error: "Clé non trouvée" }); return; }
    await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
