import { Router, type IRouter } from "express";
import { db, usersTable, subscriptionsTable, coinTransactionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

const PLANS = {
  starter: { price: 500, bonusCoins: 100, label: "Starter" },
  pro: { price: 1500, bonusCoins: 350, label: "Pro" },
  business: { price: 4000, bonusCoins: 1000, label: "Business" },
};

// GET /api/subscriptions/me
router.get("/subscriptions/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [sub] = await db.select().from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, req.userId!))
    .orderBy(desc(subscriptionsTable.startedAt))
    .limit(1);

  res.json({ subscription: sub && sub.isActive ? sub : null });
});

// POST /api/subscriptions/subscribe
router.post("/subscriptions/subscribe", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { plan } = req.body;
  const planConfig = PLANS[plan as keyof typeof PLANS];
  if (!planConfig) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const isAdmin = user.role === 'admin';
  if (!isAdmin && user.coins < planConfig.price) {
    res.status(400).json({ error: `Insufficient coins. You have ${user.coins}, need ${planConfig.price}.` });
    return;
  }

  // Cancel any existing subscription
  await db.update(subscriptionsTable).set({ isActive: false, cancelledAt: new Date() })
    .where(eq(subscriptionsTable.userId, req.userId!));

  const nextBilling = new Date();
  nextBilling.setMonth(nextBilling.getMonth() + 1);

  // Create new subscription
  const [sub] = await db.insert(subscriptionsTable).values({
    userId: req.userId!,
    planName: plan,
    pricePerMonth: planConfig.price,
    bonusCoins: planConfig.bonusCoins,
    isActive: true,
    nextBillingAt: nextBilling,
  }).returning();

  // Deduct coins (skip for admins)
  const newCoins = isAdmin ? user.coins : user.coins - planConfig.price;
  if (!isAdmin) {
    await db.update(usersTable).set({ coins: newCoins }).where(eq(usersTable.id, req.userId!));
  }

  // Record transaction
  await db.insert(coinTransactionsTable).values({
    userId: req.userId!,
    type: "debit",
    category: "subscription",
    amount: planConfig.price,
    description: `Abonnement ${planConfig.label} activé`,
    reference: `sub_${sub.id}`,
  });

  // Add bonus coins
  if (planConfig.bonusCoins > 0) {
    const withBonus = newCoins + planConfig.bonusCoins;
    await db.update(usersTable).set({ coins: withBonus }).where(eq(usersTable.id, req.userId!));
    await db.insert(coinTransactionsTable).values({
      userId: req.userId!,
      type: "credit",
      category: "subscription_bonus",
      amount: planConfig.bonusCoins,
      description: `Bonus ${planConfig.label} — coins offerts`,
      reference: `sub_${sub.id}`,
    });
  }

  res.json({ success: true, subscription: sub });
});

// POST /api/subscriptions/cancel
router.post("/subscriptions/cancel", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  await db.update(subscriptionsTable)
    .set({ isActive: false, cancelledAt: new Date() })
    .where(eq(subscriptionsTable.userId, req.userId!));

  res.json({ success: true });
});

export default router;
