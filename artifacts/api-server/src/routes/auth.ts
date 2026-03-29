import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, generateToken, type AuthRequest } from "../middlewares/auth";
import crypto from "crypto";
import { sendEmail, emailTemplates } from "../mailer";

const router: IRouter = Router();

function generateReferralCode(username: string): string {
  const hash = crypto.createHash("md5").update(username + Date.now()).digest("hex");
  return (username.substring(0, 4) + hash.substring(0, 6)).toUpperCase();
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    emailVerified: user.emailVerified,
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
  const verificationCode = generateCode();
  const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  const [user] = await db.insert(usersTable).values({
    name, email, username, passwordHash, referralCode, coins: 10,
    verificationCode, verificationExpires,
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

  // Send verification email (non-blocking)
  const tpl = emailTemplates.verificationEmail(name, verificationCode);
  sendEmail(email, tpl.subject, tpl.html).catch(() => {});

  const token = generateToken(user.id);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  const identifier = email; // can be email or username
  if (!identifier || !password) {
    res.status(400).json({ error: "Email/username and password required" });
    return;
  }

  // Try by email first, then by username
  const isEmail = identifier.includes("@");
  let user;
  if (isEmail) {
    [user] = await db.select().from(usersTable).where(eq(usersTable.email, identifier)).limit(1);
  } else {
    [user] = await db.select().from(usersTable).where(eq(usersTable.username, identifier)).limit(1);
  }

  // Fallback: if not found by email, try username and vice versa
  if (!user) {
    if (isEmail) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.username, identifier)).limit(1);
    } else {
      [user] = await db.select().from(usersTable).where(eq(usersTable.email, identifier)).limit(1);
    }
  }

  if (!user) {
    res.status(401).json({ error: "Identifiants invalides" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.banned) {
    res.status(403).json({ error: "Votre compte a été banni. Contactez le support." });
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

// POST /api/auth/send-verification — (re)envoie le code de vérification email
router.post("/auth/send-verification", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.emailVerified) { res.json({ success: true, message: "Email already verified" }); return; }

    const verificationCode = generateCode();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    await db.update(usersTable).set({ verificationCode, verificationExpires }).where(eq(usersTable.id, req.userId!));

    const tpl = emailTemplates.verificationEmail(user.name, verificationCode);
    await sendEmail(user.email, tpl.subject, tpl.html);

    res.json({ success: true, message: "Verification email sent" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/verify-email — vérifie le code de vérification email
router.post("/auth/verify-email", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "Code requis" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (user.emailVerified) { res.json({ success: true, message: "Email already verified" }); return; }

    if (!user.verificationCode || user.verificationCode !== code.trim()) {
      res.status(400).json({ error: "Code incorrect" });
      return;
    }

    if (!user.verificationExpires || user.verificationExpires < new Date()) {
      res.status(400).json({ error: "Code expiré, demandez-en un nouveau" });
      return;
    }

    // Mark as verified, award 5 bonus coins, clear code
    await db.update(usersTable).set({
      emailVerified: true,
      verificationCode: null,
      verificationExpires: null,
      coins: sql`coins + 5`,
    }).where(eq(usersTable.id, req.userId!));

    await db.insert(coinTransactionsTable).values({
      userId: req.userId!,
      type: "credit",
      category: "welcome",
      amount: 5,
      description: "Email vérifié — bonus +5 coins 🎉",
      reference: "email_verified",
    });

    const [updatedUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    res.json({ success: true, user: publicUser(updatedUser) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot-password — envoie un code de réinitialisation (public)
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: "Email requis" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);

    // Always respond OK to avoid user enumeration
    if (!user) {
      res.json({ success: true, message: "Si cet email existe, un code a été envoyé" });
      return;
    }

    const resetCode = generateCode();
    const resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000);

    await db.update(usersTable).set({ resetCode, resetCodeExpires }).where(eq(usersTable.id, user.id));

    const tpl = emailTemplates.resetPasswordEmail(user.name, resetCode);
    await sendEmail(user.email, tpl.subject, tpl.html);

    res.json({ success: true, message: "Si cet email existe, un code a été envoyé" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/reset-password — réinitialise le mot de passe avec le code (public)
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      res.status(400).json({ error: "Email, code et nouveau mot de passe requis" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (!user) { res.status(400).json({ error: "Code invalide ou expiré" }); return; }

    if (!user.resetCode || user.resetCode !== code.trim()) {
      res.status(400).json({ error: "Code incorrect" });
      return;
    }

    if (!user.resetCodeExpires || user.resetCodeExpires < new Date()) {
      res.status(400).json({ error: "Code expiré, demandez-en un nouveau" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({
      passwordHash,
      resetCode: null,
      resetCodeExpires: null,
    }).where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Mot de passe réinitialisé avec succès" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/daily-login — award daily login coins (once per day)
router.post("/auth/daily-login", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const key = `daily_${today}`;

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
