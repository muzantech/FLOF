import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const deploymentsTable = pgTable("deployments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projectsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("queued"), // queued, building, deployed, failed, cancelled, rolled_back
  url: text("url"),
  commit: text("commit"),
  commitMessage: text("commit_message"),
  branch: text("branch"),
  duration: integer("duration"),
  isProduction: boolean("is_production").notNull().default(false),
  // Pterodactyl integration
  serverId: text("server_id"),           // Pterodactyl server identifier
  method: text("method"),               // zip | github | template
  snapshotPath: text("snapshot_path"),  // path to rollback snapshot zip
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const deploymentLogsTable = pgTable("deployment_logs", {
  id: serial("id").primaryKey(),
  deploymentId: integer("deployment_id").notNull().references(() => deploymentsTable.id),
  level: text("level").notNull().default("info"), // info, warn, error
  message: text("message").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeploymentSchema = createInsertSchema(deploymentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deploymentsTable.$inferSelect;

export const insertDeploymentLogSchema = createInsertSchema(deploymentLogsTable).omit({ id: true });
export type InsertDeploymentLog = z.infer<typeof insertDeploymentLogSchema>;
export type DeploymentLog = typeof deploymentLogsTable.$inferSelect;
