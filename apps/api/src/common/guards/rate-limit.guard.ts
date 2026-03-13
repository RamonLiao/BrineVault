import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, REDIS } from '../constants.js';
import type { Redis } from 'ioredis';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<{
      limit: number;
      window: number;
    }>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);
    if (!config) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const key = user
      ? `rate:user:${user.sub}`
      : `rate:ip:${request.ip}`;

    const now = Date.now();
    const windowStart = now - config.window * 1000;

    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), `${now}-${Math.random()}`);
    pipeline.zcard(key);
    pipeline.expire(key, config.window);
    const results = await pipeline.exec();

    const count = results?.[2]?.[1] as number;
    if (count > config.limit) {
      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', String(config.window));
      throw new HttpException(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Retry after ${config.window}s`,
            details: { retry_after: config.window },
          },
        },
        429,
      );
    }

    return true;
  }
}
