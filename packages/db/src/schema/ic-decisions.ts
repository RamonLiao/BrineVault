import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { pools } from "./pools.js";

export const icDecisions = pgTable(
  "ic_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    decisionIndex: integer("decision_index").notNull(),
    decisionType: smallint("decision_type").notNull(),
    decisionText: text("decision_text"),
    decisionPdfBlobId: text("decision_pdf_blob_id"),
    createdByAddress: text("created_by_address").notNull(),
    committeeMembers: jsonb("committee_members").notNull().default([]),
    votes: jsonb("votes").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    relatedDocIds: jsonb("related_doc_ids").default([]),
  },
  (table) => [
    uniqueIndex("idx_ic_pool_index").on(table.poolId, table.decisionIndex),
    index("idx_ic_creator").on(table.createdByAddress),
  ],
);
