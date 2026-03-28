import { Router, type IRouter } from "express";
import { db, usersTable, referralsTable, coinTransactionsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import crypto from "crypto";

const router: IRouter = Router();

const REFERRAL_REWARD = 50;

function generateReferralCode(username: string): string {
  const hash = crypto.createHash("md5").update(username + Date.now()).digest("hex");
  return (username.substring(0, 4) + hash.substring(0, 6)).toUpperCase();
}

// GET /api/referrals/my
router.get("/referrals/my", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!user.referralCode) {
    const code = generateReferralCode(user.username);
    await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id));
    user.referralCode = code;
  }

  const referrals = await db.select({
    id: referralsTable.id,
    rewardCoins: referralsTable.rewardCoins,
    createdAt: referralsTable.createdAt,
    referredName: usersTable.name,
    referredUsername: usersTable.username,
  }).from(referralsTable)
    .leftJoin(usersTable, eq(referralsTable.referredId, usersTable.id))
    .where(eq(referralsTable.referrerId, req.userId!))
    .orderBy(desc(referralsTable.createdAt));

  const totalEarned = referrals.reduce((s, r) => s + r.rewardCoins, 0);

  res.json({
    referralCode: user.referralCode,
    referrals,
    totalEarned,
    totalCount: referrals.length,
  });
});

// GET /api/referral/info — spec-compatible route
router.get("/referral/info", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (!user.referralCode) {
    const code = generateReferralCode(user.username);
    await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id));
    user.referralCode = code;
  }

  const referralsList = await db.select().from(referralsTable).where(eq(referralsTable.referrerId, req.userId!));
  const totalEarned = referralsList.reduce((s, r) => s + r.rewardCoins, 0);

  res.json({
    code: user.referralCode,
    url: `${process.env.APP_URL || "https://flihost.site"}/register?ref=${user.referralCode}`,
    referralCount: referralsList.length,
    totalCoinsEarned: totalEarned,
  });
});

// GET /api/referral/leaderboard — top 10 referrers
router.get("/referral/leaderboard", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select({
      userId: referralsTable.referrerId,
      totalCoins: count(referralsTable.id),
      name: usersTable.name,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    }).from(referralsTable)
      .leftJoin(usersTable, eq(referralsTable.referrerId, usersTable.id))
      .groupBy(referralsTable.referrerId, usersTable.name, usersTable.username, usersTable.avatarUrl)
      .orderBy(desc(count(referralsTable.id)))
      .limit(10);
    res.json({ leaderboard: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/daily-reward/claim — full streak system
router.post("/daily-reward/claim", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const now = new Date();
    const lastClaim = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null;

    // Cooldown: 20 hours
    if (lastClaim) {
      const hoursAgo = (now.getTime() - lastClaim.getTime()) / 1000 / 3600;
      if (hoursAgo < 20) {
        const nextClaim = new Date(lastClaim.getTime() + 20 * 3600 * 1000);
        res.status(429).json({
          error: "Récompense déjà réclamée",
          nextClaimAt: nextClaim.toISOString(),
          hoursLeft: (20 - hoursAgo).toFixed(1),
        });
        return;
      }
    }

    // Calculate streak
    let streak = 1;
    if (lastClaim) {
      const hoursAgo = (now.getTime() - lastClaim.getTime()) / 1000 / 3600;
      if (hoursAgo < 24) {
        streak = (user.streakDays || 0) + 1;
      } else {
        streak = 1; // streak broken
      }
    }

    // Base coins: 5 + (streak * 2)
    let coinsToGive = 5 + (streak * 2);

    // Streak bonuses
    if (streak === 7)   coinsToGive += 20;
    if (streak === 14)  coinsToGive += 30;
    if (streak === 30)  coinsToGive += 50;
    if (streak === 100) coinsToGive += 100;
    if (streak === 365) coinsToGive += 500;

    const newBalance = user.coins + coinsToGive;
    const nextBonusAt = streak < 7 ? 7 : streak < 14 ? 14 : streak < 30 ? 30 : streak < 100 ? 100 : 365;

    await db.update(usersTable).set({
      coins: newBalance,
      streakDays: streak,
      lastDailyClaim: now,
    }).where(eq(usersTable.id, req.userId!));

    await db.insert(coinTransactionsTable).values({
      userId: req.userId!,
      type: "credit",
      category: "daily_login",
      amount: coinsToGive,
      description: `Récompense journalière — Jour ${streak} (streak)`,
    });

    res.json({
      coinsGiven: coinsToGive,
      newBalance,
      streak,
      nextBonusAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrals/apply
router.post("/referrals/apply", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { code } = req.body;
  if (!code) { res.status(400).json({ error: "Referral code required" }); return; }

  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!currentUser) { res.status(404).json({ error: "User not found" }); return; }

  if (currentUser.referredBy) {
    res.status(400).json({ error: "You've already used a referral code" });
    return;
  }

  const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, code.toUpperCase())).limit(1);
  if (!referrer) { res.status(404).json({ error: "Invalid referral code" }); return; }
  if (referrer.id === req.userId) { res.status(400).json({ error: "Cannot use your own referral code" }); return; }

  // Check existing referral
  const existing = await db.select().from(referralsTable)
    .where(eq(referralsTable.referredId, req.userId!)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Referral already applied" });
    return;
  }

  // Create referral record
  await db.insert(referralsTable).values({
    referrerId: referrer.id,
    referredId: req.userId!,
    rewardCoins: REFERRAL_REWARD,
  });

  // Reward referrer
  await db.update(usersTable).set({ coins: referrer.coins + REFERRAL_REWARD }).where(eq(usersTable.id, referrer.id));
  await db.insert(coinTransactionsTable).values({
    userId: referrer.id,
    type: "credit",
    category: "referral",
    amount: REFERRAL_REWARD,
    description: `Parrainage de ${currentUser.username}`,
    reference: `ref_${currentUser.id}`,
  });

  // Give coins to referred user too
  const referredBonus = 25;
  await db.update(usersTable).set({
    coins: currentUser.coins + referredBonus,
    referredBy: referrer.id,
  }).where(eq(usersTable.id, req.userId!));
  await db.insert(coinTransactionsTable).values({
    userId: req.userId!,
    type: "credit",
    category: "referral",
    amount: referredBonus,
    description: `Bonus parrainage — code de ${referrer.username}`,
    reference: `ref_${referrer.id}`,
  });

  res.json({ success: true, coinsEarned: referredBonus });
});

export default router;
