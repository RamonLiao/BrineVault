import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper } from '../helpers/auth.helper.js';
import { RateLimitGuard } from '../../src/common/guards/rate-limit.guard.js';
import { RateLimit } from '../../src/common/decorators/rate-limit.decorator.js';
import { Public } from '../../src/common/decorators/public.decorator.js';

// Test controller with rate limiting applied
@Controller('test-rate-limit')
class TestRateLimitController {
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit(3, 60)
  @Get('public')
  publicEndpoint() {
    return { ok: true };
  }

  @UseGuards(RateLimitGuard)
  @RateLimit(2, 60)
  @Get('protected')
  protectedEndpoint() {
    return { ok: true };
  }
}

describe('RateLimitGuard E2E', () => {
  let t: TestApp;
  let auth: AuthHelper;

  beforeAll(async () => {
    t = await createTestApp({
      extraControllers: [TestRateLimitController],
      extraProviders: [RateLimitGuard],
    });
    auth = new AuthHelper(t.app);
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    await t.redis.flushall();
  });

  it('allows requests under limit', async () => {
    for (let i = 0; i < 3; i++) {
      await t.agent.get('/v1/test-rate-limit/public').expect(200);
    }
  });

  it('returns 429 when limit exceeded', async () => {
    // 3 requests allowed
    for (let i = 0; i < 3; i++) {
      await t.agent.get('/v1/test-rate-limit/public').expect(200);
    }

    // 4th request → 429
    const res = await t.agent.get('/v1/test-rate-limit/public').expect(429);

    expect(res.body.error.code).toMatch(/RATE_LIMIT_EXCEEDED|HTTP_429/);
  });

  it('includes Retry-After header on 429', async () => {
    for (let i = 0; i < 3; i++) {
      await t.agent.get('/v1/test-rate-limit/public').expect(200);
    }

    const res = await t.agent.get('/v1/test-rate-limit/public').expect(429);

    expect(res.headers['retry-after']).toBe('60');
  });

  it('uses user-based key for authenticated requests', async () => {
    const user = await auth.createAuthenticatedUser();

    // 2 requests allowed for protected endpoint
    for (let i = 0; i < 2; i++) {
      await t.agent
        .get('/v1/test-rate-limit/protected')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .expect(200);
    }

    // 3rd → 429
    const res = await t.agent
      .get('/v1/test-rate-limit/protected')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(429);

    expect(res.body.error.code).toMatch(/RATE_LIMIT_EXCEEDED|HTTP_429/);
  });

  it('different users have independent rate limits', async () => {
    const user1 = await auth.createAuthenticatedUser();
    const user2 = await auth.createAuthenticatedUser();

    // Exhaust user1's limit
    for (let i = 0; i < 2; i++) {
      await t.agent
        .get('/v1/test-rate-limit/protected')
        .set('Authorization', `Bearer ${user1.accessToken}`)
        .expect(200);
    }

    // user1 blocked
    await t.agent
      .get('/v1/test-rate-limit/protected')
      .set('Authorization', `Bearer ${user1.accessToken}`)
      .expect(429);

    // user2 still has quota
    await t.agent
      .get('/v1/test-rate-limit/protected')
      .set('Authorization', `Bearer ${user2.accessToken}`)
      .expect(200);
  });
});
