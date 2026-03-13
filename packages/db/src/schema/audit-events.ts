import {
  pgTable,
  uuid,
  text,
  bigint,
  bigserial,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { pools } from "./pools.js";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    poolId: uuid("pool_id").references(() => pools.id, { onDelete: "set null" }),
    eventType: text("event_type").notNull(),
    actorAddress: text("actor_address").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").default({}),
    suiTxDigest: text("sui_tx_digest").notNull(),
    suiEventSeq: bigint("sui_event_seq", { mode: "bigint" }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_audit_pool_ts").on(table.poolId, table.timestamp),
    index("idx_audit_actor_ts").on(table.actorAddress, table.timestamp),
    index("idx_audit_event_type").on(table.eventType),
    uniqueIndex("idx_audit_tx_seq").on(table.suiTxDigest, table.suiEventSeq),
  ],
);
