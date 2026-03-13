import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { pools } from "./pools.js";

export const datarooms = pgTable(
  "datarooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    suiObjectId: text("sui_object_id").notNull().unique(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    ownerAddress: text("owner_address").notNull(),
    memberCount: integer("member_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_datarooms_pool_id").on(table.poolId),
    index("idx_datarooms_owner").on(table.ownerAddress),
  ],
);
