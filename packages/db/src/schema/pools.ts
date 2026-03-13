import {
  pgTable,
  uuid,
  text,
  bigint,
  date,
  smallint,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";

export const pools = pgTable(
  "pools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    suiObjectId: text("sui_object_id").notNull().unique(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    borrowerNameHash: text("borrower_name_hash"),
    currency: text("currency").notNull().default("USD"),
    targetNotional: bigint("target_notional", { mode: "bigint" }),
    expectedMaturityDate: date("expected_maturity_date"),
    currentState: smallint("current_state").notNull().default(0),
    encryptionScheme: smallint("encryption_scheme").notNull().default(0),
    createdByAddress: text("created_by_address").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
    suiTxDigest: text("sui_tx_digest"),
  },
  (table) => [
    index("idx_pools_org_id").on(table.orgId),
    index("idx_pools_current_state").on(table.currentState),
    index("idx_pools_created_by").on(table.createdByAddress),
    index("idx_pools_created_at").on(table.createdAt),
    check("chk_pool_state", sql`${table.currentState} BETWEEN 0 AND 8`),
    check("chk_encryption_scheme", sql`${table.encryptionScheme} IN (0, 1)`),
  ],
);
