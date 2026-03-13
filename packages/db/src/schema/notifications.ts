import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { pools } from "./pools.js";
import { documents } from "./documents.js";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    relatedPoolId: uuid("related_pool_id").references(() => pools.id, {
      onDelete: "set null",
    }),
    relatedDocumentId: uuid("related_document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notifications_user_read_ts").on(
      table.userId,
      table.isRead,
      table.createdAt,
    ),
    index("idx_notifications_pool").on(table.relatedPoolId),
  ],
);
