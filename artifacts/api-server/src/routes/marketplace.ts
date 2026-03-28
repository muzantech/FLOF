import { Router, type IRouter } from "express";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import {
  marketplaceItemsTable,
  marketplacePurchasesTable,
  marketplaceReviewsTable,
} from "@workspace/db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { createNotification } from "./notifications";

const router: IRouter = Router();
const COMMISSION_RATE = 0.1; // 10%

// GET /api/marketplace — list items with filters
router.get("/marketplace", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { category, minPrice, maxPrice, sort = "newest" } = req.query as any;
    let query = db.select({
      item: marketplaceItemsTable,
      sellerName: usersTable.name,
      sellerUsername: usersTable.username,
    })
      .from(marketplaceItemsTable)
      .leftJoin(usersTable, eq(marketplaceItemsTable.sellerId, usersTable.id));

    const conditions = [];
    if (category) conditions.push(eq(marketplaceItemsTable.category, category));
    if (minPrice) conditions.push(gte(marketplaceItemsTable.priceCoins, parseInt(minPrice)));
    if (maxPrice) conditions.push(lte(marketplaceItemsTable.priceCoins, parseInt(maxPrice)));

    const items = await (conditions.length > 0
      ? query.where(and(...conditions)).orderBy(desc(marketplaceItemsTable.createdAt)).limit(50)
      : query.orderBy(desc(marketplaceItemsTable.createdAt)).limit(50));

    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/marketplace — create an item
router.post("/marketplace", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { title, description, category, priceCoins, fileContent, fileName, previewUrl, tags } = req.body;
    if (!title || !description || !category || !priceCoins) {
      res.status(400).json({ error: "Champs requis : title, description, category, priceCoins" }); return;
    }
    if (priceCoins < 1) { res.status(400).json({ error: "Prix minimum : 1 coin" }); return; }

    const [item] = await db.insert(marketplaceItemsTable).values({
      sellerId: req.userId!,
      title,
      description,
      category,
      priceCoins,
      fileContent,
      fileName,
      previewUrl,
      tags: tags || [],
    }).returning();

    res.status(201).json({ item });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/marketplace/:id — item detail + reviews
router.get("/marketplace/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [itemRow] = await db.select({
      item: marketplaceItemsTable,
      sellerName: usersTable.name,
      sellerUsername: usersTable.username,
    })
      .from(marketplaceItemsTable)
      .leftJoin(usersTable, eq(marketplaceItemsTable.sellerId, usersTable.id))
      .where(eq(marketplaceItemsTable.id, id))
      .limit(1);

    if (!itemRow) { res.status(404).json({ error: "Article non trouvé" }); return; }

    const reviews = await db.select({
      review: marketplaceReviewsTable,
      reviewerName: usersTable.name,
    })
      .from(marketplaceReviewsTable)
      .leftJoin(usersTable, eq(marketplaceReviewsTable.userId, usersTable.id))
      .where(eq(marketplaceReviewsTable.itemId, id))
      .orderBy(desc(marketplaceReviewsTable.createdAt))
      .limit(20);

    // Check if current user already purchased
    const [purchased] = await db.select().from(marketplacePurchasesTable)
      .where(and(eq(marketplacePurchasesTable.itemId, id), eq(marketplacePurchasesTable.buyerId, req.userId!)))
      .limit(1);

    res.json({ ...itemRow, reviews, alreadyPurchased: !!purchased });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/marketplace/:id/buy
router.post("/marketplace/:id/buy", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const [item] = await db.select().from(marketplaceItemsTable).where(eq(marketplaceItemsTable.id, id)).limit(1);
    if (!item) { res.status(404).json({ error: "Article non trouvé" }); return; }
    if (item.sellerId === req.userId!) { res.status(400).json({ error: "Vous ne pouvez pas acheter votre propre article" }); return; }

    // Check not already purchased
    const [existing] = await db.select().from(marketplacePurchasesTable)
      .where(and(eq(marketplacePurchasesTable.itemId, id), eq(marketplacePurchasesTable.buyerId, req.userId!)))
      .limit(1);
    if (existing) { res.status(400).json({ error: "Déjà acheté", fileContent: item.fileContent }); return; }

    const [buyer] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
    if (!buyer) { res.status(404).json({ error: "Acheteur non trouvé" }); return; }
    if (buyer.coins < item.priceCoins) {
      res.status(400).json({ error: `Coins insuffisants. Requis : ${item.priceCoins}, Disponible : ${buyer.coins}` }); return;
    }

    const commission = Math.floor(item.priceCoins * COMMISSION_RATE);
    const sellerRevenue = item.priceCoins - commission;

    // Deduct from buyer
    await db.update(usersTable).set({ coins: sql`coins - ${item.priceCoins}` }).where(eq(usersTable.id, req.userId!));
    await db.insert(coinTransactionsTable).values({
      userId: req.userId!, type: "debit", category: "purchase",
      amount: item.priceCoins, description: `Achat marketplace : "${item.title}"`, reference: `mp-${id}`,
    });

    // Credit seller
    await db.update(usersTable).set({ coins: sql`coins + ${sellerRevenue}` }).where(eq(usersTable.id, item.sellerId));
    await db.insert(coinTransactionsTable).values({
      userId: item.sellerId, type: "credit", category: "marketplace_sale",
      amount: sellerRevenue, description: `Vente marketplace : "${item.title}"`, reference: `mp-${id}`,
    });

    // Record purchase
    await db.insert(marketplacePurchasesTable).values({
      itemId: id, buyerId: req.userId!, sellerId: item.sellerId,
      pricePaid: item.priceCoins, commission,
    });

    // Increment downloads
    await db.update(marketplaceItemsTable).set({ downloads: sql`downloads + 1` }).where(eq(marketplaceItemsTable.id, id));

    // Notify seller
    await createNotification(item.sellerId, "payment", "💰 Vente marketplace", `"${item.title}" acheté pour ${item.priceCoins} coins (+${sellerRevenue} après commission)`);

    res.json({ success: true, fileContent: item.fileContent, fileName: item.fileName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/marketplace/:id/review
router.post("/marketplace/:id/review", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) { res.status(400).json({ error: "Note invalide (1-5)" }); return; }

    // Must have purchased
    const [purchased] = await db.select().from(marketplacePurchasesTable)
      .where(and(eq(marketplacePurchasesTable.itemId, id), eq(marketplacePurchasesTable.buyerId, req.userId!)))
      .limit(1);
    if (!purchased) { res.status(403).json({ error: "Vous devez acheter l'article avant de le noter" }); return; }

    // Check not already reviewed
    const [existing] = await db.select().from(marketplaceReviewsTable)
      .where(and(eq(marketplaceReviewsTable.itemId, id), eq(marketplaceReviewsTable.userId, req.userId!)))
      .limit(1);
    if (existing) { res.status(400).json({ error: "Vous avez déjà noté cet article" }); return; }

    await db.insert(marketplaceReviewsTable).values({ itemId: id, userId: req.userId!, rating, comment });

    // Update item average rating
    const reviews = await db.select().from(marketplaceReviewsTable).where(eq(marketplaceReviewsTable.itemId, id));
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    await db.update(marketplaceItemsTable)
      .set({ rating: avg, ratingCount: reviews.length })
      .where(eq(marketplaceItemsTable.id, id));

    res.status(201).json({ success: true, newRating: avg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/marketplace/my — seller's own items
router.get("/marketplace-my", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const items = await db.select().from(marketplaceItemsTable)
      .where(eq(marketplaceItemsTable.sellerId, req.userId!))
      .orderBy(desc(marketplaceItemsTable.createdAt));
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
