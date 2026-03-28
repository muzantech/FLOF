import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { resellersTable, resellerClientsTable, promoCodesTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";

const router: IRouter = Router();

// POST /api/reseller/register — become a reseller
router.post("/reseller/register", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { businessName, shopSlug } = req.body;
    if (!businessName || !shopSlug) { res.status(400).json({ error: "Nom commercial et slug requis" }); return; }

    const slugRegex = /^[a-z0-9-]{3,32}$/;
    if (!slugRegex.test(shopSlug)) { res.status(400).json({ error: "Slug invalide (3-32 caractères, minuscules, chiffres, tirets)" }); return; }

    const existing = await db.select().from(resellersTable).where(eq(resellersTable.userId, req.userId!)).limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "Vous êtes déjà revendeur" }); return; }

    const slugTaken = await db.select().from(resellersTable).where(eq(resellersTable.shopSlug, shopSlug)).limit(1);
    if (slugTaken.length > 0) { res.status(400).json({ error: "Ce slug est déjà pris" }); return; }

    const [reseller] = await db.insert(resellersTable).values({
      userId: req.userId!,
      businessName,
      shopSlug,
      commissionRate: 0.1,
      contractSignedAt: new Date(),
    }).returning();

    await db.update(usersTable).set({ isReseller: true }).where(eq(usersTable.id, req.userId!));

    res.status(201).json({ reseller });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reseller/dashboard
router.get("/reseller/dashboard", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [reseller] = await db.select().from(resellersTable).where(eq(resellersTable.userId, req.userId!)).limit(1);
    if (!reseller) { res.status(403).json({ error: "Vous n'êtes pas revendeur" }); return; }

    const clients = await db.select().from(resellerClientsTable).where(eq(resellerClientsTable.resellerId, reseller.id));
    const promoCodes = await db.select().from(promoCodesTable).where(eq(promoCodesTable.creatorId, req.userId!));

    res.json({
      reseller,
      clientCount: clients.length,
      promoCodes,
      stats: {
        totalClients: clients.length,
        balanceCoins: reseller.balanceCoins,
        commissionRate: reseller.commissionRate,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reseller/clients — add a client
router.post("/reseller/clients", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { clientEmail } = req.body;
    const [reseller] = await db.select().from(resellersTable).where(eq(resellersTable.userId, req.userId!)).limit(1);
    if (!reseller) { res.status(403).json({ error: "Vous n'êtes pas revendeur" }); return; }

    const [client] = await db.select().from(usersTable).where(eq(usersTable.email, clientEmail)).limit(1);
    if (!client) { res.status(404).json({ error: "Utilisateur non trouvé" }); return; }

    const existing = await db.select().from(resellerClientsTable)
      .where(and(eq(resellerClientsTable.resellerId, reseller.id), eq(resellerClientsTable.clientUserId, client.id)))
      .limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "Client déjà ajouté" }); return; }

    await db.insert(resellerClientsTable).values({ resellerId: reseller.id, clientUserId: client.id });
    res.status(201).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reseller/clients
router.get("/reseller/clients", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [reseller] = await db.select().from(resellersTable).where(eq(resellersTable.userId, req.userId!)).limit(1);
    if (!reseller) { res.status(403).json({ error: "Vous n'êtes pas revendeur" }); return; }

    const clients = await db.select({
      id: resellerClientsTable.id,
      clientId: resellerClientsTable.clientUserId,
      name: usersTable.name,
      email: usersTable.email,
      coins: usersTable.coins,
      createdAt: resellerClientsTable.createdAt,
    })
      .from(resellerClientsTable)
      .leftJoin(usersTable, eq(resellerClientsTable.clientUserId, usersTable.id))
      .where(eq(resellerClientsTable.resellerId, reseller.id));

    res.json({ clients });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reseller/promo — create promo code
router.post("/reseller/promo", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { code, discountPercent, bonusCoins, maxUses, expiresAt } = req.body;
    const [reseller] = await db.select().from(resellersTable).where(eq(resellersTable.userId, req.userId!)).limit(1);
    if (!reseller) { res.status(403).json({ error: "Vous n'êtes pas revendeur" }); return; }
    if (!code || !discountPercent) { res.status(400).json({ error: "Code et remise requis" }); return; }
    if (discountPercent < 1 || discountPercent > 50) { res.status(400).json({ error: "Remise entre 1% et 50%" }); return; }

    const [promo] = await db.insert(promoCodesTable).values({
      code: code.toUpperCase(),
      creatorId: req.userId!,
      discountPercent,
      bonusCoins: bonusCoins || 0,
      maxUses: maxUses || 100,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }).returning();

    res.status(201).json({ promo });
  } catch (err: any) {
    if (err.message?.includes("unique")) { res.status(400).json({ error: "Ce code existe déjà" }); return; }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reseller/withdraw — request coin withdrawal
router.post("/reseller/withdraw", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { amount } = req.body;
    const [reseller] = await db.select().from(resellersTable).where(eq(resellersTable.userId, req.userId!)).limit(1);
    if (!reseller) { res.status(403).json({ error: "Vous n'êtes pas revendeur" }); return; }
    if (!amount || amount <= 0) { res.status(400).json({ error: "Montant invalide" }); return; }
    if (reseller.balanceCoins < amount) { res.status(400).json({ error: `Balance insuffisante. Disponible : ${reseller.balanceCoins} coins` }); return; }

    await db.update(resellersTable)
      .set({ balanceCoins: sql`balance_coins - ${amount}` })
      .where(eq(resellersTable.id, reseller.id));

    await db.update(usersTable)
      .set({ coins: sql`coins + ${amount}` })
      .where(eq(usersTable.id, req.userId!));

    await db.insert(coinTransactionsTable).values({
      userId: req.userId!, type: "credit", category: "reseller_withdraw",
      amount, description: `Retrait revendeur : ${amount} coins`,
    });

    res.json({ success: true, newBalance: reseller.balanceCoins - amount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/promo/validate — validate a promo code
router.get("/promo/validate", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { code } = req.query as { code?: string };
    if (!code) { res.status(400).json({ error: "Code requis" }); return; }

    const [promo] = await db.select().from(promoCodesTable)
      .where(eq(promoCodesTable.code, code.toUpperCase()))
      .limit(1);

    if (!promo || !promo.active) { res.status(404).json({ error: "Code promo invalide" }); return; }
    if (promo.expiresAt && promo.expiresAt < new Date()) { res.status(400).json({ error: "Code promo expiré" }); return; }
    if (promo.usesCount >= promo.maxUses) { res.status(400).json({ error: "Code promo épuisé" }); return; }

    res.json({ valid: true, discountPercent: promo.discountPercent, bonusCoins: promo.bonusCoins });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
