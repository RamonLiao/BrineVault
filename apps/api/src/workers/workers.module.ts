import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationDispatcherService } from './notification-dispatcher.service.js';
import { SubscriptionMonitorService } from './subscription-monitor.service.js';
import { WalrusRenewalService } from './walrus-renewal.service.js';
import { CostTrackerService } from './cost-tracker.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    NotificationDispatcherService,
    SubscriptionMonitorService,
    WalrusRenewalService,
    CostTrackerService,
  ],
  exports: [NotificationDispatcherService],
})
export class WorkersModule {}
