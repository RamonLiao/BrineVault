import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { documents } from "./documents.js";
import { pools } from "./pools.js";

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    authorAddress: text("author_address").notNull(),
    content: text("content").notNull(),
    parentCommentId: uuid("parent_comment_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_comments_doc_ts").on(table.documentId, table.createdAt),
    index("idx_comments_pool").on(table.poolId),
    index("idx_comments_parent").on(table.parentCommentId),
    index("idx_comments_author").on(table.authorAddress),
  ],
);
