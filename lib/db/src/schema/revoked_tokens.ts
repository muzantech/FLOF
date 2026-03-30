import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const revokedTokensTable = pgTable("revoked_tokens", {
  id: serial("id").primaryKey(),
  jti: text("jti").notNull().unique(),
  userId: integer("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at").defaultNow().notNull(),
});
