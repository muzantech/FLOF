import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { paymentTransactionsTable, promoCodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { createNotification } from "./notifications";
import { sendEmail, emailTemplates } from "../mailer";

const router: IRouter = Router();

const MONEYFUSION_URL = process.env.MONEYFUSION_PAY_URL || "https://www.pay.moneyfusion.net/FLYHOST/pay/";
const APP_URL = process.env.APP_URL || "https://flihost.site";

const COINS_PACKAGES = [
  { id: "coins_100",  coins: 100,  priceFcfa: 500,   label: "100 Coins" },
  { id: "coins_250",  coins: 250,  priceFcfa: 1100,  label: "250 Coins" },
  { id: "coins_500",  coins: 500,  priceFcfa: 2000,  label: "500 Coins" },
  { id: "coins_1000", coins: 1000, priceFcfa: 3500,  label: "1 000 Coins" },
  { id: "coins_2500", coins: 2500, priceFcfa: 8000,  label: "2 500 Coins" },
];

// GET /api/payment/packages — list purchasable coin packages
router.get("/payment/packages", requireAuth, (_req, res): void => {
  res.json({ packages: COINS_PACKAGES });
});

// POST /api/payment/initiate — start a MoneyFusion payment
router.post("/payment/initiate", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { packageId, promoCode } = req.body;
    const pkg = COINS_PACKAGES.find(p => p.id === packageId);
    if (!pkg) { res.status(400).json({ error: "Package invalide" }); return; }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    let finalAmount = pkg.priceFcfa;
    let bonusCoins = 0;

    // Apply promo code if provided
    if (promoCode) {
      const [promo] = await db.select().from(promoCodesTable)
        .where(eq(promoCodesTable.code, promoCode.toUpperCase()))
        .limit(1);
      if (promo && promo.active && (!promo.expiresAt || promo.expiresAt > new Date()) && promo.usesCount < promo.maxUses) {
        finalAmount = Math.floor(finalAmount * (1 - promo.discountPercent / 100));
        bonusCoins = promo.bonusCoins;
        await db.update(promoCodesTable).set({ usesCount: sql`uses_count + 1` }).where(eq(promoCodesTable.id, promo.id));
      } else {
        res.status(400).json({ error: "Code promo invalide ou expiré" }); return;
      }
    }

    const paymentId = randomUUID();

    // Insert pending transaction
    await db.insert(paymentTransactionsTable).values({
      userId: req.userId!,
      paymentId,
      amount: finalAmount,
      currency: "XOF",
      type: "coins",
      status: "pending",
      metadata: { packageId, coins: pkg.coins + bonusCoins, bonusCoins, originalAmount: pkg.priceFcfa, promoCode },
    });

    // Call MoneyFusion API
    const mfRes = await fetch(MONEYFUSION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalPrice: finalAmount,
        devise: "XOF",
        infoOrdre: `FlyHost — ${pkg.label}`,
        numeroOrdre: paymentId,
        urlRedirect: `${APP_URL}/payment/callback?id=${paymentId}`,
        urlIpn: `${APP_URL}/api/payment/webhook`,
        nomclient: user.name || user.username,
        personal_Info: [{ label: "Email", value: user.email }],
      }),
    });

    let mfData: any = {};
    try { mfData = await mfRes.json(); } catch {}

    if (!mfRes.ok || !mfData.url) {
      // If MoneyFusion fails (sandbox/test), return a test URL
      console.warn("[payment] MoneyFusion returned:", JSON.stringify(mfData));
      res.json({ paymentUrl: `${APP_URL}/payment/test?id=${paymentId}`, paymentId, testMode: true });
      return;
    }

    // Save MoneyFusion token
    if (mfData.token) {
      await db.update(paymentTransactionsTable).set({ tokenPay: mfData.token }).where(eq(paymentTransactionsTable.paymentId, paymentId));
    }

    res.json({ paymentUrl: mfData.url, paymentId });
  } catch (err: any) {
    console.error("[payment] initiate error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/payment/webhook — MoneyFusion IPN callback
router.post("/payment/webhook", async (req, res): Promise<void> => {
  try {
    const { tokenPay, statut } = req.body;
    if (!tokenPay) { res.json({ status: "ignored" }); return; }

    // Find transaction by token
    const txns = await db.select().from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.tokenPay, tokenPay))
      .limit(1);

    if (txns.length === 0) {
      // Try by paymentId (some integrations send this)
      const byId = await db.select().from(paymentTransactionsTable)
        .where(eq(paymentTransactionsTable.paymentId, tokenPay))
        .limit(1);
      if (byId.length === 0) { res.json({ status: "not_found" }); return; }
      txns.push(byId[0]);
    }

    const txn = txns[0];
    if (txn.status !== "pending") { res.json({ status: "already_processed" }); return; }

    const success = statut === "paid" || statut === "completed" || statut === "success";
    const newStatus = success ? "completed" : "failed";

    await db.update(paymentTransactionsTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(paymentTransactionsTable.id, txn.id));

    if (success) {
      const meta = txn.metadata as any || {};
      const coinsToAdd = meta.coins || 0;

      if (txn.type === "coins" && coinsToAdd > 0) {
        // Add coins to user
        await db.update(usersTable)
          .set({ coins: sql`coins + ${coinsToAdd}` })
          .where(eq(usersTable.id, txn.userId));

        // Log coin transaction
        await db.insert(coinTransactionsTable).values({
          userId: txn.userId,
          type: "credit",
          category: "purchase",
          amount: coinsToAdd,
          description: `Achat ${coinsToAdd} coins — paiement #${txn.paymentId.substring(0, 8)}`,
          reference: txn.paymentId,
        });

        // Notify user
        await createNotification(txn.userId, "payment", "💰 Paiement reçu", `${coinsToAdd} coins ont été ajoutés à votre solde`);

        // Send email
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, txn.userId)).limit(1);
        if (user) {
          await sendEmail(user.email, "✅ Paiement FlyHost confirmé", `
            <div style="font-family:sans-serif;padding:24px;background:#09090B;color:#FAFAFA;border-radius:12px">
              <h2 style="color:#FACC15">Paiement confirmé !</h2>
              <p><strong>${coinsToAdd} coins</strong> ont été ajoutés à votre compte FlyHost.</p>
              <p>Montant payé : <strong>${txn.amount} ${txn.currency}</strong></p>
              <p>Référence : <code>${txn.paymentId}</code></p>
            </div>
          `);
        }
      }
    }

    res.json({ status: "ok" });
  } catch (err: any) {
    console.error("[payment] webhook error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payment/status/:token — check payment status
router.get("/payment/status/:token", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [txn] = await db.select().from(paymentTransactionsTable)
      .where(eq(paymentTransactionsTable.paymentId, req.params.token))
      .limit(1);
    if (!txn || txn.userId !== req.userId!) { res.status(404).json({ error: "Transaction not found" }); return; }
    res.json({ status: txn.status, amount: txn.amount, currency: txn.currency, type: txn.type, metadata: txn.metadata });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /payment/callback — browser redirect after MoneyFusion payment
router.get("/payment/callback", async (req, res): Promise<void> => {
  const { id } = req.query as { id?: string };
  if (!id) { res.redirect("/"); return; }

  const [txn] = await db.select().from(paymentTransactionsTable)
    .where(eq(paymentTransactionsTable.paymentId, id)).limit(1);

  if (!txn) { res.redirect("/?payment=not_found"); return; }
  if (txn.status === "completed") { res.redirect("/?payment=success"); return; }
  if (txn.status === "failed") { res.redirect("/?payment=failed"); return; }

  // Poll MoneyFusion for final status
  res.redirect(`/?payment=pending&id=${id}`);
});

export default router;
