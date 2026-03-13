import {
  pgTable,
  uuid,
  text,
  smallint,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    primaryWalletAddress: text("primary_wallet_address").notNull().unique(),
    email: text("email"),
    displayName: text("display_name"),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    roleInOrg: smallint("role_in_org").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_users_org").on(table.orgId),
    index("idx_users_email").on(table.email),
    index("idx_users_wallet").on(table.primaryWalletAddress),
  ],
);
