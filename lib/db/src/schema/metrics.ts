import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";

export const serverMetricsTable = pgTable("server_metrics", {
  id: serial("id").primaryKey(),
  serverId: text("server_id").notNull(),
  cpuPercent: real("cpu_percent").notNull().default(0),
  ramMb: real("ram_mb").notNull().default(0),
  diskMb: real("disk_mb").notNull().default(0),
  networkRx: integer("network_rx").notNull().default(0),
  networkTx: integer("network_tx").notNull().default(0),
  state: text("state").notNull().default("offline"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const restartSchedulesTable = pgTable("restart_schedules", {
  id: serial("id").primaryKey(),
  serverId: text("server_id").notNull(),
  userId: integer("user_id").notNull(),
  frequency: text("frequency").notNull().default("daily"), // hourly | daily | weekly
  hour: integer("hour").notNull().default(4),
  minute: integer("minute").notNull().default(0),
  enabled: integer("enabled").notNull().default(1),
  lastRun: timestamp("last_run", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
