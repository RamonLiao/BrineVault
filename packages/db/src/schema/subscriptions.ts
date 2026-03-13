import {
  pgTable,
  uuid,
  text,
  decimal,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { billingPlanEnum, subscriptionStatusEnum } from "./enums.js";
import { organizations } from "./organizations.js";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    plan: billingPlanEnum("plan").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("trial"),
    trialStartAt: timestamp("trial_start_at", { withTimezone: true }),
    trialEndAt: timestamp("trial_end_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    gracePeriodEnd: timestamp("grace_period_end", { withTimezone: true }),
    penaltyRate: decimal("penalty_rate", { precision: 4, scale: 2 }).notNull().default("1.30"),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
    currency: text("currency").notNull().default("SGD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_subscriptions_org").on(table.orgId),
    index("idx_subscriptions_status").on(table.status),
    index("idx_subscriptions_period_end").on(table.currentPeriodEnd),
  ],
);
