import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const serverSubdomainsTable = pgTable("server_subdomains", {
  id: serial("id").primaryKey(),
  subdomain: text("subdomain").notNull().unique(),
  pterodactylIdentifier: text("pterodactyl_identifier").notNull(),
  port: integer("port").notNull(),
  ip: text("ip").notNull().default("127.0.0.1"),
  userId: integer("user_id").references(() => usersTable.id),
  isTrial: boolean("is_trial").notNull().default(false),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServerSubdomainSchema = createInsertSchema(serverSubdomainsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServerSubdomain = z.infer<typeof insertServerSubdomainSchema>;
export type ServerSubdomain = typeof serverSubdomainsTable.$inferSelect;
