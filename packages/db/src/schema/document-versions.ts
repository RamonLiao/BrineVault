import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { documents } from "./documents.js";

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    walrusBlobId: text("walrus_blob_id").notNull(),
    contentHash: text("content_hash").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "bigint" }).notNull().default(BigInt(0)),
    uploadedByAddress: text("uploaded_by_address").notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
    changeLog: text("change_log"),
  },
  (table) => [
    uniqueIndex("idx_docversions_doc_version").on(table.documentId, table.version),
    index("idx_docversions_blob").on(table.walrusBlobId),
    index("idx_docversions_uploader").on(table.uploadedByAddress),
    check("chk_version_positive", sql`${table.version} > 0`),
  ],
);
