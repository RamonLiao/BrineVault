import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const inviteCodes = pgTable(
  "invite_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    maxUses: integer("max_uses").notNull().default(1),
    currentUses: integer("current_uses").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_invites_org").on(table.orgId),
    index("idx_invites_code").on(table.code),
    index("idx_invites_expires").on(table.expiresAt),
    check("chk_invite_uses", sql`${table.currentUses} <= ${table.maxUses}`),
    check("chk_invite_max", sql`${table.maxUses} > 0`),
  ],
);
