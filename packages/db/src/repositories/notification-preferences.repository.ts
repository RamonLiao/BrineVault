import { eq } from "drizzle-orm";
import { notificationPreferences } from "../schema/notification-preferences.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for notification_preferences table. */
export class NotificationPreferencesRepository extends BaseRepository {
  async findByUserId(userId: string) {
    const rows = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsert(userId: string, data: Partial<typeof notificationPreferences.$inferInsert>) {
    const existing = await this.findByUserId(userId);
    if (existing) {
      const rows = await this.db
        .update(notificationPreferences)
        .set(data)
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return rows[0]!;
    }
    const rows = await this.db
      .insert(notificationPreferences)
      .values({ userId, ...data })
      .returning();
    return rows[0]!;
  }
}
