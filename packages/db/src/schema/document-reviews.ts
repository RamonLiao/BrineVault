import {
  pgTable,
  uuid,
  text,
  smallint,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { documents } from "./documents.js";

export const documentReviews = pgTable(
  "document_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    reviewerAddress: text("reviewer_address").notNull(),
    status: smallint("status").notNull().default(0),
    commentHash: text("comment_hash"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_reviews_doc_reviewer").on(table.documentId, table.reviewerAddress),
    index("idx_reviews_status").on(table.documentId, table.status),
    check("chk_review_status", sql`${table.status} BETWEEN 0 AND 2`),
  ],
);
