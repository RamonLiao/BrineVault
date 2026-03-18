import { Controller, Get, Inject } from '@nestjs/common';
import { DATABASE, REDIS } from '../../common/constants.js';
import type { Database } from '@rwa-dataroom/db';
import type { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import { Public } from '../../common/decorators/public.decorator.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    let dbOk = false;
    let redisOk = false;

    try {
      await this.db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {
      /* db unreachable */
    }

    try {
      await this.redis.ping();
      redisOk = true;
    } catch {
      /* redis unreachable */
    }

    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      db: dbOk,
      redis: redisOk,
      uptime: process.uptime(),
    };
  }
}
