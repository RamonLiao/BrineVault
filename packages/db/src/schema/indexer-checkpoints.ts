import {
  pgTable,
  integer,
  text,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";

export const indexerCheckpoints = pgTable("indexer_checkpoints", {
  id: integer("id").primaryKey(),
  chainId: text("chain_id").notNull(),
  lastCursor: text("last_cursor"),
  lastTxDigest: text("last_tx_digest"),
  lastEventSeq: bigint("last_event_seq", { mode: "bigint" }).notNull().default(BigInt(0)),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
