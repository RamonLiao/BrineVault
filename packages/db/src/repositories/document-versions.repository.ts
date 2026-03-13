import { eq, and } from "drizzle-orm";
import { documentVersions } from "../schema/document-versions.js";
import { BaseRepository } from "./base.js";

/** Read-only repository for on-chain synced document_versions table. */
export class DocumentVersionsRepository extends BaseRepository {
  async findByDocumentId(documentId: string) {
    return this.db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(documentVersions.version);
  }

  async findByDocumentAndVersion(documentId: string, version: number) {
    const rows = await this.db
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, documentId),
          eq(documentVersions.version, version),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  // --- Indexer write methods ---

  async insertFromEvent(data: typeof documentVersions.$inferInsert) {
    const rows = await this.db
      .insert(documentVersions)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return rows[0] ?? null;
  }
}
