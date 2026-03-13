import { eq, and } from "drizzle-orm";
import { documentReviews } from "../schema/document-reviews.js";
import { BaseRepository } from "./base.js";

/** Read-only repository for on-chain synced document_reviews table. */
export class DocumentReviewsRepository extends BaseRepository {
  async findByDocumentId(documentId: string) {
    return this.db
      .select()
      .from(documentReviews)
      .where(eq(documentReviews.documentId, documentId));
  }

  async findByDocumentAndReviewer(documentId: string, reviewerAddress: string) {
    const rows = await this.db
      .select()
      .from(documentReviews)
      .where(
        and(
          eq(documentReviews.documentId, documentId),
          eq(documentReviews.reviewerAddress, reviewerAddress),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  // --- Indexer write methods ---

  async upsertFromEvent(data: typeof documentReviews.$inferInsert) {
    return this.db
      .insert(documentReviews)
      .values(data)
      .onConflictDoUpdate({
        target: [documentReviews.documentId, documentReviews.reviewerAddress],
        set: {
          status: data.status,
          commentHash: data.commentHash,
          reviewedAt: new Date(),
        },
      })
      .returning();
  }
}
