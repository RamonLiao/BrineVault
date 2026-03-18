import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CostTrackerService {
  private readonly logger = new Logger(CostTrackerService.name);

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron() {
    this.logger.log('Cost tracker aggregation — stub (no Walrus deployed yet)');
    // TODO: Phase 2 — aggregate Walrus storage costs per pool per billing period
  }
}
