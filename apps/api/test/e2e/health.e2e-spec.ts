import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';

describe('GET /v1/health', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  it('returns ok when db and redis are healthy', async () => {
    const res = await t.agent.get('/v1/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe(true);
    expect(res.body.redis).toBe(true);
    expect(res.body.uptime).toBeGreaterThan(0);
  });

  it('returns degraded when db is down', async () => {
    t.db.execute.mockRejectedValueOnce(new Error('connection refused'));

    const res = await t.agent.get('/v1/health').expect(200);

    expect(res.body.status).toBe('degraded');
    expect(res.body.db).toBe(false);
    expect(res.body.redis).toBe(true);
  });

  it('returns degraded when redis is down', async () => {
    const original = t.redis.ping.bind(t.redis);
    vi.spyOn(t.redis, 'ping').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await t.agent.get('/v1/health').expect(200);

    expect(res.body.status).toBe('degraded');
    expect(res.body.db).toBe(true);
    expect(res.body.redis).toBe(false);

    vi.restoreAllMocks();
  });

  it('returns degraded when both are down', async () => {
    t.db.execute.mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(t.redis, 'ping').mockRejectedValueOnce(new Error('redis down'));

    const res = await t.agent.get('/v1/health').expect(200);

    expect(res.body.status).toBe('degraded');
    expect(res.body.db).toBe(false);
    expect(res.body.redis).toBe(false);

    vi.restoreAllMocks();
  });

  it('is accessible without authentication', async () => {
    // No Bearer token — should still return 200 (public route)
    const res = await t.agent.get('/v1/health');
    expect(res.status).toBe(200);
  });
});
