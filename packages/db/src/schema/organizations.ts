import { pgTable, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { billingPlanEnum } from "./enums.js";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    billingPlan: billingPlanEnum("billing_plan").notNull().default("free_trial"),
    defaultPolicies: jsonb("default_policies").default({}),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_orgs_name").on(table.name),
    index("idx_orgs_plan").on(table.billingPlan),
  ],
);
