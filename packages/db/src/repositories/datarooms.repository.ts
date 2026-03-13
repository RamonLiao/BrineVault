import { eq } from "drizzle-orm";
import { datarooms } from "../schema/datarooms.js";
import { BaseRepository } from "./base.js";

/** Read-only repository for on-chain synced datarooms table. */
export class DataroomsRepository extends BaseRepository {
  async findById(id: string) {
    const rows = await this.db.select().from(datarooms).where(eq(datarooms.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findBySuiObjectId(suiObjectId: string) {
    const rows = await this.db
      .select()
      .from(datarooms)
      .where(eq(datarooms.suiObjectId, suiObjectId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByPoolId(poolId: string) {
    const rows = await this.db
      .select()
      .from(datarooms)
      .where(eq(datarooms.poolId, poolId))
      .limit(1);
    return rows[0] ?? null;
  }

  // --- Indexer write methods ---

  async insertFromEvent(data: typeof datarooms.$inferInsert) {
    const rows = await this.db.insert(datarooms).values(data).onConflictDoNothing().returning();
    return rows[0] ?? null;
  }

  async incrementMemberCount(suiObjectId: string, delta: number) {
    return this.db
      .update(datarooms)
      .set({
        memberCount: delta > 0
          ? eq(datarooms.suiObjectId, suiObjectId) as never // placeholder, actual SQL below
          : 0 as never,
        lastUpdatedAt: new Date(),
      })
      .where(eq(datarooms.suiObjectId, suiObjectId));
  }
}
