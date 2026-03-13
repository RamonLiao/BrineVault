import { eq, asc } from "drizzle-orm";
import { comments } from "../schema/comments.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for off-chain comments table. */
export class CommentsRepository extends BaseRepository {
  async findByDocumentId(documentId: string) {
    return this.db
      .select()
      .from(comments)
      .where(eq(comments.documentId, documentId))
      .orderBy(asc(comments.createdAt));
  }

  async create(data: typeof comments.$inferInsert) {
    const rows = await this.db.insert(comments).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, content: string) {
    return this.db
      .update(comments)
      .set({ content, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
  }

  async delete(id: string) {
    return this.db.delete(comments).where(eq(comments.id, id));
  }
}
