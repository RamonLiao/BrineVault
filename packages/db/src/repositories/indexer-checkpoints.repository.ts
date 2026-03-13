import { eq } from "drizzle-orm";
import { indexerCheckpoints } from "../schema/indexer-checkpoints.js";
import { BaseRepository } from "./base.js";

/** Repository for indexer checkpoint management. */
export class IndexerCheckpointsRepository extends BaseRepository {
  async getCheckpoint(id: number = 1) {
    const rows = await this.db
      .select()
      .from(indexerCheckpoints)
      .where(eq(indexerCheckpoints.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsertCheckpoint(data: typeof indexerCheckpoints.$inferInsert) {
    return this.db
      .insert(indexerCheckpoints)
      .values(data)
      .onConflictDoUpdate({
        target: indexerCheckpoints.id,
        set: {
          lastCursor: data.lastCursor,
          lastTxDigest: data.lastTxDigest,
          lastEventSeq: data.lastEventSeq,
          updatedAt: new Date(),
        },
      })
      .returning();
  }
}
