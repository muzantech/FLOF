import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, generateToken, type AuthRequest } from "../middlewares/auth";
import crypto from "crypto";

const router: IRouter = Router();

function generateReferralCode(username: string): string {
  const hash = crypto.createHash("md5").update(username + Date.now()).digest("hex");
  return (username.substring(0, 4) + hash.substring(0, 6)).toUpperCase();
}

function publicUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
    coins: user.coins,
    referralCode: user.referralCode,
    onboardingDone: user.onboardingDone,
    createdAt: user.createdAt,
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, email, password, username } = req.body;
  if (!name || !email || !password || !username) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already in use" });
    return;
  }

  const existingUsername = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existingUsername.length > 0) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const referralCode = generateReferralCode(username);

  const [user] = await db.insert(usersTable).values({
    name, email, username, passwordHash, referralCode, coins: 10,
  }).returning();

  // Welcome coins transaction
  await db.insert(coinTransactionsTable).values({
    userId: user.id,
    type: "credit",
    category: "welcome",
    amount: 10,
    description: "Bonus de bienvenue sur FLYHOST 🎉",
    reference: "welcome",
  });

  const token = generateToken(user.id);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken(user.id);
  res.json({ token, user: publicUser(user) });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(publicUser(user));
});

router.patch("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { name, avatarUrl } = req.body;
  const [user] = await db.update(usersTable).set({ name, avatarUrl }).where(eq(usersTable.id, req.userId!)).returning();
  res.json(publicUser(user));
});

// POST /api/auth/daily-login — award daily login coins (once per day)
router.post("/auth/daily-login", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const key = `daily_${today}`;

  // Check if already credited today
  const existing = await db.select().from(coinTransactionsTable)
    .where(eq(coinTransactionsTable.userId, req.userId!))
    .limit(100);

  const alreadyCredited = existing.some(t => t.reference === key);
  if (alreadyCredited) {
    res.json({ success: false, message: "Already credited today", coinsEarned: 0 });
    return;
  }

  const DAILY_COINS = 5;
  await db.update(usersTable).set({ coins: sql`coins + ${DAILY_COINS}` }).where(eq(usersTable.id, req.userId!));
  await db.insert(coinTransactionsTable).values({
    userId: req.userId!,
    type: "credit",
    category: "daily_login",
    amount: DAILY_COINS,
    description: "Connexion quotidienne ☀️",
    reference: key,
  });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  res.json({ success: true, coinsEarned: DAILY_COINS, totalCoins: user.coins });
});

export default router;
