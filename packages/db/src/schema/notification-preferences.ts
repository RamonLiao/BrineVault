import {
  pgTable,
  uuid,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  preferences: jsonb("preferences").notNull().default({}),
});
