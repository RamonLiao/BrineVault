import {
  pgTable,
  uuid,
  text,
  decimal,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { invoiceStatusEnum } from "./enums.js";
import { organizations } from "./organizations.js";
import { subscriptions } from "./subscriptions.js";

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("SGD"),
    status: invoiceStatusEnum("status").notNull().default("pending"),
    penaltyApplied: boolean("penalty_applied").notNull().default(false),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_invoices_org").on(table.orgId),
    index("idx_invoices_subscription").on(table.subscriptionId),
    index("idx_invoices_status").on(table.status),
    index("idx_invoices_due").on(table.dueAt),
  ],
);
