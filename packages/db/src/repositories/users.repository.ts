import { eq } from "drizzle-orm";
import { users } from "../schema/users.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for off-chain users table. */
export class UsersRepository extends BaseRepository {
  async findById(id: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByWalletAddress(address: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.primaryWalletAddress, address))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsertByWallet(data: typeof users.$inferInsert) {
    return this.db
      .insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.primaryWalletAddress,
        set: { lastLoginAt: new Date() },
      })
      .returning();
  }

  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    return this.db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
  }
}
