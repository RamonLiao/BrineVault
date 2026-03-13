import { eq, and, desc, sql } from "drizzle-orm";
import { auditEvents } from "../schema/audit-events.js";
import { BaseRepository } from "./base.js";

/** Read-only repository for on-chain synced audit_events table. */
export class AuditEventsRepository extends BaseRepository {
  async findByPoolId(poolId: string, opts?: { limit?: number; offset?: number }) {
    return this.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.poolId, poolId))
      .orderBy(desc(auditEvents.timestamp))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);
  }

  async findByActorAddress(actorAddress: string, opts?: { limit?: number; offset?: number }) {
    return this.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorAddress, actorAddress))
      .orderBy(desc(auditEvents.timestamp))
      .limit(opts?.limit ?? 50)
      .offset(opts?.offset ?? 0);
  }

  async existsByTxSeq(suiTxDigest: string, suiEventSeq: bigint) {
    const rows = await this.db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.suiTxDigest, suiTxDigest),
          eq(auditEvents.suiEventSeq, suiEventSeq),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  // --- Indexer write methods ---

  async insertFromEvent(data: typeof auditEvents.$inferInsert) {
    const rows = await this.db
      .insert(auditEvents)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return rows[0] ?? null;
  }
}
