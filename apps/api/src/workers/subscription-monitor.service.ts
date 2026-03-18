import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsRepository } from '@rwa-dataroom/db';
import { NotificationDispatcherService } from './notification-dispatcher.service.js';

@Injectable()
export class SubscriptionMonitorService {
  private readonly logger = new Logger(SubscriptionMonitorService.name);

  constructor(
    @Inject(SubscriptionsRepository) private readonly subsRepo: SubscriptionsRepository,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron() {
    try {
      await this.checkExpiring();
      await this.checkGracePeriodExpired();
    } catch (err) {
      this.logger.error('Subscription monitor failed', err);
    }
  }

  private async checkExpiring() {
    const now = new Date();
    const expiring = await this.subsRepo.findExpiring(now);
    for (const sub of expiring) {
      try {
        const gracePeriodEnd = new Date(now);
        gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 14);
        await this.subsRepo.update(sub.id, { status: 'grace_period', gracePeriodEnd });
        await this.dispatcher.dispatch({
          type: 'subscription_expiring',
          title: `Subscription expired for org ${sub.orgId}`,
          body: `Your ${sub.plan} subscription has expired. You have a 14-day grace period.`,
          recipientUserIds: [sub.orgId],
        });
      } catch (err) {
        this.logger.error(`Failed to process expiring sub ${sub.id}`, err);
      }
    }
  }

  private async checkGracePeriodExpired() {
    const now = new Date();
    const expired = await this.subsRepo.findGracePeriodExpired(now);
    for (const sub of expired) {
      try {
        await this.subsRepo.update(sub.id, { status: 'suspended' });
        await this.dispatcher.dispatch({
          type: 'subscription_expired',
          title: `Account suspended for org ${sub.orgId}`,
          body: 'Your grace period has ended. Account is now suspended.',
          recipientUserIds: [sub.orgId],
        });
      } catch (err) {
        this.logger.error(`Failed to process grace-expired sub ${sub.id}`, err);
      }
    }
  }
}
