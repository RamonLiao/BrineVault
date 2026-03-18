import { Injectable, Inject, Logger } from '@nestjs/common';
import { NotificationsRepository, NotificationPreferencesRepository } from '@rwa-dataroom/db';

export interface DispatchPayload {
  type: string;
  title: string;
  body?: string;
  recipientUserIds: string[];
  relatedPoolId?: string;
  relatedDocumentId?: string;
}

const MANDATORY_TYPES = new Set([
  'subscription_expiring',
  'subscription_expired',
  'invoice_overdue',
]);

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @Inject(NotificationsRepository) private readonly notifRepo: NotificationsRepository,
    @Inject(NotificationPreferencesRepository) private readonly prefsRepo: NotificationPreferencesRepository,
  ) {}

  async dispatch(payload: DispatchPayload): Promise<void> {
    for (const userId of payload.recipientUserIds) {
      try {
        const shouldSend = await this.shouldSendInApp(userId, payload.type);
        if (!shouldSend) continue;
        await this.notifRepo.create({
          userId, type: payload.type, title: payload.title,
          body: payload.body ?? null,
          relatedPoolId: payload.relatedPoolId ?? null,
          relatedDocumentId: payload.relatedDocumentId ?? null,
        });
      } catch (err) {
        this.logger.error(`Failed to dispatch notification to ${userId}`, err);
      }
    }
  }

  private async shouldSendInApp(userId: string, type: string): Promise<boolean> {
    if (MANDATORY_TYPES.has(type)) return true;
    const prefs = await this.prefsRepo.findByUserId(userId);
    if (!prefs) return true;
    if (!prefs.inAppEnabled) return false;
    const typePrefs = (prefs.preferences as Record<string, any>)?.[type];
    if (typePrefs && typePrefs.in_app === false) return false;
    return true;
  }
}
