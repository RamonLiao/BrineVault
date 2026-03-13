import { eq } from "drizzle-orm";
import { organizations } from "../schema/organizations.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for off-chain organizations table. */
export class OrganizationsRepository extends BaseRepository {
  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: typeof organizations.$inferInsert) {
    const rows = await this.db.insert(organizations).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<typeof organizations.$inferInsert>) {
    return this.db
      .update(organizations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
  }
}
