import { pgEnum } from "drizzle-orm/pg-core";

export const billingPlanEnum = pgEnum("billing_plan", [
  "free_trial",
  "pro",
  "enterprise",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trial",
  "active",
  "expired",
  "grace_period",
  "suspended",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "paid",
  "overdue",
  "cancelled",
]);

export const checklistItemStatusEnum = pgEnum("checklist_item_status", [
  "missing",
  "uploaded",
  "reviewed",
  "needs_revision",
]);
