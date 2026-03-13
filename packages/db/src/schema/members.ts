import {
  pgTable,
  uuid,
  text,
  smallint,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { datarooms } from "./datarooms.js";
import { pools } from "./pools.js";

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataroomId: uuid("dataroom_id")
      .notNull()
      .references(() => datarooms.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    memberAddress: text("member_address").notNull(),
    role: smallint("role").notNull(),
    addedByAddress: text("added_by_address").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_members_dataroom_address").on(table.dataroomId, table.memberAddress),
    index("idx_members_pool_id").on(table.poolId),
    index("idx_members_address").on(table.memberAddress),
    index("idx_members_active").on(table.dataroomId, table.isActive),
    check("chk_member_role", sql`${table.role} > 0 AND ${table.role} <= 63`),
  ],
);
