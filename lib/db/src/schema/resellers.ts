import { pgTable, text, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const resellersTable = pgTable("resellers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull(),
  shopSlug: text("shop_slug").notNull().unique(),
  commissionRate: real("commission_rate").notNull().default(0.1),
  balanceCoins: integer("balance_coins").notNull().default(0),
  contractSignedAt: timestamp("contract_signed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const resellerClientsTable = pgTable("reseller_clients", {
  id: serial("id").primaryKey(),
  resellerId: integer("reseller_id").notNull().references(() => resellersTable.id, { onDelete: "cascade" }),
  clientUserId: integer("client_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promoCodesTable = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  creatorId: integer("creator_id").references(() => usersTable.id, { onDelete: "set null" }),
  discountPercent: integer("discount_percent").notNull(),
  bonusCoins: integer("bonus_coins").notNull().default(0),
  maxUses: integer("max_uses").notNull().default(100),
  usesCount: integer("uses_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
