import { and, eq, inArray, lte } from "drizzle-orm";
import { subscriptions } from "../schema/subscriptions.js";
import { invoices } from "../schema/invoices.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for subscriptions + invoices. */
export class SubscriptionsRepository extends BaseRepository {
  // --- Subscriptions ---

  async findByOrgId(orgId: string) {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.orgId, orgId))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: typeof subscriptions.$inferInsert) {
    const rows = await this.db.insert(subscriptions).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<typeof subscriptions.$inferInsert>) {
    return this.db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
  }

  // --- Invoices ---

  async findInvoiceById(id: string) {
    const rows = await this.db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findInvoicesByOrgId(orgId: string, opts?: { limit?: number; offset?: number }) {
    const q = this.db.select().from(invoices).where(eq(invoices.orgId, orgId));
    if (opts?.limit !== undefined) q.limit(opts.limit);
    if (opts?.offset !== undefined) q.offset(opts.offset);
    return q;
  }

  async findExpiring(beforeDate: Date) {
    return this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.status, ["active", "trial"]),
          lte(subscriptions.currentPeriodEnd, beforeDate),
        ),
      );
  }

  async findGracePeriodExpired(beforeDate: Date) {
    return this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "grace_period"),
          lte(subscriptions.gracePeriodEnd, beforeDate),
        ),
      );
  }

  async createInvoice(data: typeof invoices.$inferInsert) {
    const rows = await this.db.insert(invoices).values(data).returning();
    return rows[0]!;
  }

  async updateInvoice(id: string, data: Partial<typeof invoices.$inferInsert>) {
    return this.db
      .update(invoices)
      .set(data)
      .where(eq(invoices.id, id))
      .returning();
  }
}
