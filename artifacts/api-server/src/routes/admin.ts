import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { sendEmail, emailTemplates } from "../mailer";

const router = Router();

async function requireAdmin(req: AuthRequest, res: any): Promise<boolean> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    res.status(403).json({ error: "Accès refusé — admin uniquement" });
    return false;
  }
  return true;
}

// GET /api/admin/users — list all users
router.get("/admin/users", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        username: usersTable.username,
        role: usersTable.role,
        coins: usersTable.coins,
        banned: usersTable.banned,
        emailVerified: usersTable.emailVerified,
        plan: usersTable.plan,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));
    res.json({ users });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/users/:id/ban — ban ou unban un utilisateur
router.patch("/admin/users/:id/ban", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const userId = parseInt(req.params.id);
  const { banned } = req.body as { banned: boolean };

  if (userId === req.userId) {
    res.status(400).json({ error: "Vous ne pouvez pas vous bannir vous-même" });
    return;
  }

  try {
    await db.update(usersTable).set({ banned }).where(eq(usersTable.id, userId));
    res.json({ success: true, banned });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/users/:id — supprimer un compte
router.delete("/admin/users/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const userId = parseInt(req.params.id);

  if (userId === req.userId) {
    res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
    return;
  }

  try {
    await db.delete(usersTable).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/users/:id/coins — ajouter ou retirer des coins
router.post("/admin/users/:id/coins", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const userId = parseInt(req.params.id);
  const { amount } = req.body as { amount: number };

  if (typeof amount !== "number" || isNaN(amount)) {
    res.status(400).json({ error: "Montant invalide" });
    return;
  }

  try {
    const [user] = await db.select({ coins: usersTable.coins }).from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }
    const newCoins = Math.max(0, user.coins + amount);
    await db.update(usersTable).set({ coins: newCoins }).where(eq(usersTable.id, userId));
    res.json({ success: true, coins: newCoins });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/admin/users/:id/role — changer le rôle
router.patch("/admin/users/:id/role", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const userId = parseInt(req.params.id);
  const { role } = req.body as { role: string };

  if (!["user", "admin"].includes(role)) {
    res.status(400).json({ error: "Rôle invalide (user | admin)" });
    return;
  }

  if (userId === req.userId) {
    res.status(400).json({ error: "Vous ne pouvez pas modifier votre propre rôle" });
    return;
  }

  try {
    await db.update(usersTable).set({ role }).where(eq(usersTable.id, userId));
    res.json({ success: true, role });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/campaigns/send — envoyer une campagne email
router.post("/admin/campaigns/send", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  const { template, target, email: targetEmail, title, body, ctaLabel, ctaUrl, subject } = req.body as {
    template: "promo" | "announcement" | "ad" | "custom";
    target: "all" | "email";
    email?: string;
    title?: string;
    body?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    subject?: string;
  };

  if (!template || !target) {
    res.status(400).json({ error: "template et target sont requis" });
    return;
  }

  if (target === "email" && !targetEmail) {
    res.status(400).json({ error: "email requis pour target=email" });
    return;
  }

  try {
    let recipients: { name: string; email: string }[] = [];

    if (target === "all") {
      const users = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.emailVerified, true));
      recipients = users;
    } else {
      const [user] = await db.select({ name: usersTable.name, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.email, targetEmail!))
        .limit(1);
      if (!user) {
        res.status(404).json({ error: "Utilisateur introuvable avec cet email" });
        return;
      }
      recipients = [user];
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const recipient of recipients) {
      try {
        let tpl: { subject: string; html: string };

        if (template === "promo") {
          tpl = emailTemplates.campaignPromo(
            recipient.name,
            title || "Offre spéciale",
            body || "",
            ctaLabel || "Découvrir",
            ctaUrl || "https://flihost.site"
          );
        } else if (template === "announcement") {
          tpl = emailTemplates.campaignAnnouncement(recipient.name, title || "Annonce", body || "");
        } else if (template === "ad") {
          tpl = emailTemplates.campaignAd(
            recipient.name,
            title || "Offre exclusive",
            body || "",
            ctaLabel || "En savoir plus",
            ctaUrl || "https://flihost.site"
          );
        } else {
          tpl = emailTemplates.campaignCustom(recipient.name, subject || "Message de FlyHost", body || "");
        }

        await sendEmail(recipient.email, tpl.subject, tpl.html);
        sent++;
      } catch {
        failed++;
        errors.push(recipient.email);
      }
    }

    res.json({ success: true, sent, failed, total: recipients.length, errors });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
