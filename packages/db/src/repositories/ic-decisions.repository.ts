import { eq, and } from "drizzle-orm";
import { icDecisions } from "../schema/ic-decisions.js";
import { BaseRepository } from "./base.js";

/** Read-only repository for on-chain synced ic_decisions table. */
export class ICDecisionsRepository extends BaseRepository {
  async findByPoolId(poolId: string) {
    return this.db
      .select()
      .from(icDecisions)
      .where(eq(icDecisions.poolId, poolId))
      .orderBy(icDecisions.decisionIndex);
  }

  async findByPoolAndIndex(poolId: string, decisionIndex: number) {
    const rows = await this.db
      .select()
      .from(icDecisions)
      .where(
        and(eq(icDecisions.poolId, poolId), eq(icDecisions.decisionIndex, decisionIndex)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  // --- Indexer write methods ---

  async insertFromEvent(data: typeof icDecisions.$inferInsert) {
    const rows = await this.db
      .insert(icDecisions)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return rows[0] ?? null;
  }
}
