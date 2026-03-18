import { Injectable, Inject } from '@nestjs/common';
import { NotificationsRepository, NotificationPreferencesRepository } from '@rwa-dataroom/db';
import type { NotificationsQueryDto, UpdatePreferencesDto } from './notifications.schemas.js';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository) private readonly notifRepo: NotificationsRepository,
    @Inject(NotificationPreferencesRepository) private readonly prefsRepo: NotificationPreferencesRepository,
  ) {}

  async listNotifications(userId: string, query: NotificationsQueryDto) {
    const offset = (query.page - 1) * query.limit;
    const data = await this.notifRepo.findByUserId(userId, { limit: query.limit, offset });
    return { data, page: query.page, limit: query.limit };
  }

  async markAsRead(id: string, userId: string) {
    await this.notifRepo.markAsReadForUser(id, userId);
    return { id, isRead: true };
  }

  async markAllAsRead(userId: string) {
    await this.notifRepo.markAllAsRead(userId);
    return { success: true };
  }

  async getPreferences(userId: string) {
    const prefs = await this.prefsRepo.findByUserId(userId);
    if (!prefs) return { userId, emailEnabled: true, inAppEnabled: true, preferences: {} };
    return prefs;
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const existing = await this.prefsRepo.findByUserId(userId);
    const existingPrefs = (existing?.preferences as Record<string, any>) ?? {};
    const merged: Record<string, any> = { ...existingPrefs };
    if (dto.preferences) {
      for (const [key, val] of Object.entries(dto.preferences)) {
        merged[key] = { ...(existingPrefs[key] ?? {}), ...val };
      }
    }
    const updateData: Record<string, any> = { preferences: merged };
    if (dto.emailEnabled !== undefined) updateData.emailEnabled = dto.emailEnabled;
    if (dto.inAppEnabled !== undefined) updateData.inAppEnabled = dto.inAppEnabled;
    return this.prefsRepo.upsert(userId, updateData);
  }
}
