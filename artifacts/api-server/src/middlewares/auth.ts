import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "@workspace/db";
import { revokedTokensTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET;

if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET must be set. Refusing to start with a weak JWT secret.");
}

export interface AuthRequest extends Request {
  userId?: number;
  tokenJti?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: number; jti: string };
    req.userId = decoded.userId;
    req.tokenJti = decoded.jti;

    db.select()
      .from(revokedTokensTable)
      .where(eq(revokedTokensTable.jti, decoded.jti))
      .limit(1)
      .then(([revoked]) => {
        if (revoked) {
          res.status(401).json({ error: "Token révoqué, veuillez vous reconnecter" });
          return;
        }
        next();
      })
      .catch(() => next());
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

export function requireAuthFlexible(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: number; jti: string };
    req.userId = decoded.userId;
    req.tokenJti = decoded.jti;

    db.select()
      .from(revokedTokensTable)
      .where(eq(revokedTokensTable.jti, decoded.jti))
      .limit(1)
      .then(([revoked]) => {
        if (revoked) {
          res.status(401).json({ error: "Token révoqué, veuillez vous reconnecter" });
          return;
        }
        next();
      })
      .catch(() => next());
  } catch {
    res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

export function generateToken(userId: number): string {
  const jti = crypto.randomUUID();
  return jwt.sign({ userId, jti }, JWT_SECRET!, { expiresIn: "7d" });
}

export async function revokeToken(jti: string, userId: number): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(revokedTokensTable).values({ jti, userId, expiresAt }).onConflictDoNothing();

  await db.delete(revokedTokensTable).where(lt(revokedTokensTable.expiresAt, new Date()));
}
