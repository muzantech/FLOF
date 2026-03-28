import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"), // user | admin | superadmin
  coins: integer("coins").notNull().default(10),
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  onboardingDone: boolean("onboarding_done").notNull().default(false),
  bio: text("bio"),
  // Streak & daily reward
  streakDays: integer("streak_days").notNull().default(0),
  lastDailyClaim: timestamp("last_daily_claim", { withTimezone: true }),
  // Extended profile
  emailVerified: boolean("email_verified").notNull().default(false),
  whatsappNumber: text("whatsapp_number"),
  telegramChatId: text("telegram_chat_id"),
  discordWebhook: text("discord_webhook"),
  isReseller: boolean("is_reseller").notNull().default(false),
  plan: text("plan").notNull().default("free"), // free | starter | pro | business | unlimited
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
