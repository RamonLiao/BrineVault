import { eq, and, desc } from "drizzle-orm";
import { notifications } from "../schema/notifications.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for off-chain notifications table. */
export class NotificationsRepository extends BaseRepository {
  async findByUserId(userId: string, opts?: { limit?: number; offset?: number }) {
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(opts?.limit ?? 20)
      .offset(opts?.offset ?? 0);
  }

  async create(data: typeof notifications.$inferInsert) {
    const rows = await this.db.insert(notifications).values(data).returning();
    return rows[0]!;
  }

  async markAsRead(id: string) {
    return this.db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  async markAsReadForUser(id: string, userId: string) {
    return this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  }

  async markAllAsRead(userId: string) {
    return this.db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }
}
