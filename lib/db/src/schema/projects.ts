import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { teamsTable } from "./teams";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  framework: text("framework"),
  gitRepo: text("git_repo"),
  gitBranch: text("git_branch"),
  teamId: integer("team_id").references(() => teamsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull().default("active"), // active, paused, deleted
  latestDeploymentId: integer("latest_deployment_id"),
  latestDeploymentUrl: text("latest_deployment_url"),
  latestDeploymentStatus: text("latest_deployment_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
