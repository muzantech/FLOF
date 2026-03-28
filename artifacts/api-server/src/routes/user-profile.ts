import { Router, type IRouter } from "express";
import { db, usersTable, coinTransactionsTable, subscriptionsTable, referralsTable } from "@workspace/db";
import { eq, desc, sql, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import crypto from "crypto";

const router: IRouter = Router();

function generateReferralCode(username: string): string {
  const hash = crypto.createHash("md5").update(username + Date.now()).digest("hex");
  return (username.substring(0, 4) + hash.substring(0, 6)).toUpperCase();
}

// GET /api/user/profile
router.get("/user/profile", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  // Generate referral code if missing
  if (!user.referralCode) {
    const code = generateReferralCode(user.username);
    await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id));
    user.referralCode = code;
  }

  const referralCount = await db.select({ c: count() }).from(referralsTable).where(eq(referralsTable.referrerId, user.id));
  const [sub] = await db.select().from(subscriptionsTable).where(
    eq(subscriptionsTable.userId, user.id)
  ).orderBy(desc(subscriptionsTable.startedAt)).limit(1);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      coins: user.coins,
      referralCode: user.referralCode,
      onboardingDone: user.onboardingDone,
      bio: user.bio,
      createdAt: user.createdAt,
    },
    referralCount: referralCount[0]?.c || 0,
    subscription: sub && sub.isActive ? sub : null,
  });
});

// PATCH /api/user/profile
router.patch("/user/profile", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { name, bio, avatarUrl } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (bio !== undefined) updates.bio = bio;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.userId!)).returning();
  res.json({ success: true, user });
});

// POST /api/complete-onboarding
router.post("/complete-onboarding", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  await db.update(usersTable).set({ onboardingDone: true }).where(eq(usersTable.id, req.userId!));
  res.json({ success: true });
});

// GET /api/user/coins
router.get("/user/coins", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select({ coins: usersTable.coins }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  res.json({ coins: user?.coins || 0 });
});

// GET /api/user/history
router.get("/user/history", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const transactions = await db.select().from(coinTransactionsTable)
    .where(eq(coinTransactionsTable.userId, req.userId!))
    .orderBy(desc(coinTransactionsTable.createdAt))
    .limit(100);
  
  const [totals] = await db.select({
    totalCredit: sql<number>`COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END), 0)`,
    totalDebit: sql<number>`COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END), 0)`,
  }).from(coinTransactionsTable).where(eq(coinTransactionsTable.userId, req.userId!));

  res.json({ transactions, totals });
});

// GET /api/user/invoices
router.get("/user/invoices", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const invoices = await db.select().from(coinTransactionsTable)
    .where(eq(coinTransactionsTable.userId, req.userId!))
    .orderBy(desc(coinTransactionsTable.createdAt))
    .limit(50);

  const paid = invoices.filter(i => i.type === "debit");
  const totalSpent = paid.reduce((s, i) => s + i.amount, 0);

  res.json({
    invoices,
    stats: {
      total: invoices.length,
      paid: paid.length,
      totalSpent,
    }
  });
});

export default router;
