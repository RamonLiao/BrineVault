import { eq, and } from "drizzle-orm";
import { members } from "../schema/members.js";
import { BaseRepository } from "./base.js";

/** Read-only repository for on-chain synced members table. */
export class MembersRepository extends BaseRepository {
  async findByDataroomAndAddress(dataroomId: string, memberAddress: string) {
    const rows = await this.db
      .select()
      .from(members)
      .where(
        and(eq(members.dataroomId, dataroomId), eq(members.memberAddress, memberAddress)),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async findActiveByPoolId(poolId: string) {
    return this.db
      .select()
      .from(members)
      .where(and(eq(members.poolId, poolId), eq(members.isActive, true)));
  }

  async findByPoolId(poolId: string) {
    return this.db.select().from(members).where(eq(members.poolId, poolId));
  }

  // --- Indexer write methods ---

  async upsertFromEvent(data: typeof members.$inferInsert) {
    return this.db
      .insert(members)
      .values(data)
      .onConflictDoUpdate({
        target: [members.dataroomId, members.memberAddress],
        set: {
          role: data.role,
          isActive: true,
          revokedAt: null,
          addedByAddress: data.addedByAddress,
          addedAt: new Date(),
        },
      })
      .returning();
  }

  async deactivate(dataroomId: string, memberAddress: string) {
    return this.db
      .update(members)
      .set({ isActive: false, revokedAt: new Date() })
      .where(
        and(eq(members.dataroomId, dataroomId), eq(members.memberAddress, memberAddress)),
      );
  }

  async updateRole(dataroomId: string, memberAddress: string, newRole: number) {
    return this.db
      .update(members)
      .set({ role: newRole })
      .where(
        and(eq(members.dataroomId, dataroomId), eq(members.memberAddress, memberAddress)),
      );
  }
}
