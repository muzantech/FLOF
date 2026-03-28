import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, generateToken, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

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
  const [user] = await db.insert(usersTable).values({ name, email, username, passwordHash }).returning();

  const token = generateToken(user.id);
  res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, username: user.username, avatarUrl: user.avatarUrl, createdAt: user.createdAt }
  });
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
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, username: user.username, avatarUrl: user.avatarUrl, createdAt: user.createdAt }
  });
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
  res.json({ id: user.id, name: user.name, email: user.email, username: user.username, avatarUrl: user.avatarUrl, createdAt: user.createdAt });
});

router.patch("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { name, avatarUrl } = req.body;
  const [user] = await db.update(usersTable).set({ name, avatarUrl }).where(eq(usersTable.id, req.userId!)).returning();
  res.json({ id: user.id, name: user.name, email: user.email, username: user.username, avatarUrl: user.avatarUrl, createdAt: user.createdAt });
});

export default router;
