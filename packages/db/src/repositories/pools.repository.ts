import { eq, and, desc, sql } from "drizzle-orm";
import { pools } from "../schema/pools.js";
import { BaseRepository } from "./base.js";

/** Read-only repository for on-chain synced pools table. */
export class PoolsRepository extends BaseRepository {
  async findById(id: string) {
    const rows = await this.db.select().from(pools).where(eq(pools.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findBySuiObjectId(suiObjectId: string) {
    const rows = await this.db
      .select()
      .from(pools)
      .where(eq(pools.suiObjectId, suiObjectId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByOrgId(orgId: string, opts?: { limit?: number; offset?: number }) {
    return this.db
      .select()
      .from(pools)
      .where(eq(pools.orgId, orgId))
      .orderBy(desc(pools.createdAt))
      .limit(opts?.limit ?? 20)
      .offset(opts?.offset ?? 0);
  }

  async countByOrgId(orgId: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(pools)
      .where(eq(pools.orgId, orgId));
    return result[0]?.count ?? 0;
  }

  // --- Indexer write methods (only called by indexer) ---

  async insertFromEvent(data: typeof pools.$inferInsert) {
    const rows = await this.db.insert(pools).values(data).onConflictDoNothing().returning();
    return rows[0] ?? null;
  }

  async updateStateFromEvent(suiObjectId: string, newState: number, txDigest: string) {
    return this.db
      .update(pools)
      .set({
        currentState: newState,
        lastUpdatedAt: new Date(),
        suiTxDigest: txDigest,
      })
      .where(eq(pools.suiObjectId, suiObjectId));
  }
}
