import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { checklistItemStatusEnum } from "./enums.js";
import { pools } from "./pools.js";
import { documents } from "./documents.js";

export const poolChecklistItems = pgTable(
  "pool_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    folder: text("folder").notNull(),
    itemName: text("item_name").notNull(),
    isRequired: boolean("is_required").notNull().default(false),
    linkedDocumentId: uuid("linked_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    status: checklistItemStatusEnum("status").notNull().default("missing"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_checklist_pool_folder_item").on(
      table.poolId,
      table.folder,
      table.itemName,
    ),
    index("idx_checklist_pool_status").on(table.poolId, table.status),
  ],
);
