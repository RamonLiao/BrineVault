import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard.js';

function mockExecutionContext(overrides?: {
  user?: any;
  ip?: string;
}): ExecutionContext & { __response: any } {
  const response = { setHeader: vi.fn() };
  const request = {
    headers: {},
    user: overrides?.user,
    ip: overrides?.ip ?? '127.0.0.1',
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    __response: response,
  } as any;
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let mockRedis: {
    pipeline: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    reflector = new Reflector();
    mockRedis = {
      pipeline: vi.fn(),
    };
    guard = new RateLimitGuard(reflector, mockRedis as any);
  });

  it('should pass when no rate limit config on route', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(undefined);
    const ctx = mockExecutionContext();
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should pass when under limit', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce({
      limit: 10,
      window: 60,
    });

    const mockPipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0],  // zremrangebyscore
        [null, 1],  // zadd
        [null, 5],  // zcard — 5 requests, under 10 limit
        [null, 1],  // expire
      ]),
    };
    mockRedis.pipeline.mockReturnValue(mockPipeline);

    const ctx = mockExecutionContext({ user: { sub: 'user-1' } });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should throw 429 when over limit with Retry-After header', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce({
      limit: 5,
      window: 60,
    });

    const mockPipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, 6],  // 6 requests, over 5 limit
        [null, 1],
      ]),
    };
    mockRedis.pipeline.mockReturnValue(mockPipeline);

    const ctx = mockExecutionContext({ user: { sub: 'user-1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    try {
      await guard.canActivate(ctx);
    } catch (e: any) {
      expect(e.getStatus()).toBe(429);
      expect(ctx.__response.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    }
  });

  it('should use IP-based key for unauthenticated requests', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce({
      limit: 100,
      window: 60,
    });

    const mockPipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, 1],
        [null, 1],
      ]),
    };
    mockRedis.pipeline.mockReturnValue(mockPipeline);

    const ctx = mockExecutionContext({ ip: '10.0.0.1' });
    expect(await guard.canActivate(ctx)).toBe(true);
    // Pipeline was called — key would be rate:ip:10.0.0.1
    expect(mockPipeline.zremrangebyscore).toHaveBeenCalled();
  });

  // --- Monkey tests ---

  it('should handle redis pipeline exec returning null gracefully', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce({
      limit: 10,
      window: 60,
    });

    const mockPipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(null),
    };
    mockRedis.pipeline.mockReturnValue(mockPipeline);

    const ctx = mockExecutionContext({ user: { sub: 'u1' } });
    // count would be undefined, which is not > config.limit, so passes
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should handle exactly-at-limit (boundary)', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce({
      limit: 5,
      window: 60,
    });

    const mockPipeline = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 0],
        [null, 1],
        [null, 5],  // exactly at limit — should pass (not over)
        [null, 1],
      ]),
    };
    mockRedis.pipeline.mockReturnValue(mockPipeline);

    const ctx = mockExecutionContext({ user: { sub: 'u1' } });
    expect(await guard.canActivate(ctx)).toBe(true);
  });
});
