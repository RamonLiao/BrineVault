import {
  pgTable,
  uuid,
  text,
  bigint,
  smallint,
  integer,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pools } from "./pools.js";
import { datarooms } from "./datarooms.js";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    suiObjectId: text("sui_object_id").notNull().unique(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    dataroomId: uuid("dataroom_id")
      .notNull()
      .references(() => datarooms.id, { onDelete: "cascade" }),
    folderId: bigint("folder_id", { mode: "bigint" }),
    docType: smallint("doc_type").notNull().default(0),
    title: text("title").notNull(),
    tags: text("tags").array().default([]),
    currentVersion: integer("current_version").notNull().default(1),
    versionCount: integer("version_count").notNull().default(1),
    requiredFlag: boolean("required_flag").notNull().default(false),
    encryptionScheme: smallint("encryption_scheme").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_documents_pool_id").on(table.poolId),
    index("idx_documents_dataroom_id").on(table.dataroomId),
    index("idx_documents_folder").on(table.poolId, table.folderId),
    index("idx_documents_created_at").on(table.createdAt),
    check("chk_doc_encryption", sql`${table.encryptionScheme} IN (0, 1)`),
  ],
);
