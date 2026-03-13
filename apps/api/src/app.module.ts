import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { loadEnv } from './config/env.js';
import { DrizzleModule } from './infra/drizzle/drizzle.module.js';
import { RepositoriesModule } from './infra/drizzle/repositories.module.js';
import { RedisModule } from './infra/redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

const env = loadEnv();

@Module({
  imports: [
    DrizzleModule.forRoot(env.DATABASE_URL),
    RedisModule.forRoot(env.REDIS_URL),
    RepositoriesModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
