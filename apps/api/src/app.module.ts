import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { loadEnv } from './config/env.js';
import { DrizzleModule } from './infra/drizzle/drizzle.module.js';
import { RepositoriesModule } from './infra/drizzle/repositories.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { OrgsModule } from './modules/orgs/orgs.module.js';
import { SuiModule } from './infra/sui/sui.module.js';
import { PoolsModule } from './modules/pools/pools.module.js';
import { DataroomsModule } from './modules/datarooms/datarooms.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
import { ICDecisionsModule } from './modules/ic-decisions/ic-decisions.module.js';
import { ChecklistModule } from './modules/checklist/checklist.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { AuthGuard } from './common/guards/auth.guard.js';
import { CsrfGuard } from './common/guards/csrf.guard.js';

const env = loadEnv();

@Module({
  imports: [
    DrizzleModule.forRoot(env.DATABASE_URL),
    RedisModule.forRoot(env.REDIS_URL),
    RepositoriesModule,
    HealthModule,
    AuthModule,
    OrgsModule,
    SuiModule,
    PoolsModule,
    DataroomsModule,
    DocumentsModule,
    ReviewsModule,
    ICDecisionsModule,
    ChecklistModule,
    AuditModule,
    NotificationsModule,
    BillingModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
