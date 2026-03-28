import { pgTable, text, serial, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const marketplaceItemsTable = pgTable("marketplace_items", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // template | script | config | plugin | bot
  priceCoins: integer("price_coins").notNull(),
  fileContent: text("file_content"), // base64 or text content
  fileName: text("file_name"),
  downloads: integer("downloads").notNull().default(0),
  rating: real("rating").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  tags: jsonb("tags"),
  previewUrl: text("preview_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const marketplacePurchasesTable = pgTable("marketplace_purchases", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => marketplaceItemsTable.id, { onDelete: "cascade" }),
  buyerId: integer("buyer_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  sellerId: integer("seller_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  pricePaid: integer("price_paid").notNull(),
  commission: integer("commission").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const marketplaceReviewsTable = pgTable("marketplace_reviews", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => marketplaceItemsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
