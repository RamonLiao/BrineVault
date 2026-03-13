import { eq, and, desc, sql } from "drizzle-orm";
import { documents } from "../schema/documents.js";
import { BaseRepository } from "./base.js";

/** Read-only repository for on-chain synced documents table. */
export class DocumentsRepository extends BaseRepository {
  async findById(id: string) {
    const rows = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findBySuiObjectId(suiObjectId: string) {
    const rows = await this.db
      .select()
      .from(documents)
      .where(eq(documents.suiObjectId, suiObjectId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByPoolId(poolId: string, opts?: { limit?: number; offset?: number }) {
    return this.db
      .select()
      .from(documents)
      .where(eq(documents.poolId, poolId))
      .orderBy(desc(documents.createdAt))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);
  }

  async countByPoolId(poolId: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.poolId, poolId));
    return result[0]?.count ?? 0;
  }

  // --- Indexer write methods ---

  async insertFromEvent(data: typeof documents.$inferInsert) {
    const rows = await this.db.insert(documents).values(data).onConflictDoNothing().returning();
    return rows[0] ?? null;
  }

  async updateVersionInfo(suiObjectId: string, version: number) {
    return this.db
      .update(documents)
      .set({
        currentVersion: version,
        versionCount: sql`${documents.versionCount} + 1`,
        lastUpdatedAt: new Date(),
      })
      .where(eq(documents.suiObjectId, suiObjectId));
  }
}
