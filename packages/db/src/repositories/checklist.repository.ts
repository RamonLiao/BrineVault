import { eq } from "drizzle-orm";
import { checklistTemplates } from "../schema/checklist-templates.js";
import { poolChecklistItems } from "../schema/pool-checklist-items.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for checklist tables. */
export class ChecklistRepository extends BaseRepository {
  // --- Templates ---

  async findAllTemplates() {
    return this.db.select().from(checklistTemplates);
  }

  async createTemplate(data: typeof checklistTemplates.$inferInsert) {
    const rows = await this.db.insert(checklistTemplates).values(data).returning();
    return rows[0]!;
  }

  // --- Pool checklist items ---

  async findItemsByPoolId(poolId: string) {
    return this.db
      .select()
      .from(poolChecklistItems)
      .where(eq(poolChecklistItems.poolId, poolId));
  }

  async createItem(data: typeof poolChecklistItems.$inferInsert) {
    const rows = await this.db.insert(poolChecklistItems).values(data).returning();
    return rows[0]!;
  }

  async updateItem(
    id: string,
    data: Partial<typeof poolChecklistItems.$inferInsert>,
  ) {
    return this.db
      .update(poolChecklistItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(poolChecklistItems.id, id))
      .returning();
  }

  async deleteItem(id: string) {
    return this.db.delete(poolChecklistItems).where(eq(poolChecklistItems.id, id));
  }
}
