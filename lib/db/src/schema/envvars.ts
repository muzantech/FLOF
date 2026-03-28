import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const envVarsTable = pgTable("env_vars", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  key: text("key").notNull(),
  value: text("value").notNull(),
  environment: text("environment").notNull().default("production"), // production, preview, development
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEnvVarSchema = createInsertSchema(envVarsTable).omit({ id: true, createdAt: true });
export type InsertEnvVar = z.infer<typeof insertEnvVarSchema>;
export type EnvVar = typeof envVarsTable.$inferSelect;
