import { eq, sql } from "drizzle-orm";
import { inviteCodes } from "../schema/invite-codes.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for invite_codes table. */
export class InviteCodesRepository extends BaseRepository {
  async findByCode(code: string) {
    const rows = await this.db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, code))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByOrgId(orgId: string) {
    return this.db.select().from(inviteCodes).where(eq(inviteCodes.orgId, orgId));
  }

  async create(data: typeof inviteCodes.$inferInsert) {
    const rows = await this.db.insert(inviteCodes).values(data).returning();
    return rows[0]!;
  }

  async incrementUses(id: string) {
    return this.db
      .update(inviteCodes)
      .set({ currentUses: sql`${inviteCodes.currentUses} + 1` })
      .where(eq(inviteCodes.id, id))
      .returning();
  }
}
