import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = Buffer.from(
  privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
).toString('base64');
process.env.JWT_PUBLIC_KEY = Buffer.from(
  publicKey.export({ type: 'spki', format: 'pem' }) as string,
).toString('base64');
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../../modules/auth/auth.controller.js';
import type { AuthService } from '../../modules/auth/auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, any>;

  const mockAddress = '0x' + 'a'.repeat(64);

  beforeEach(() => {
    authService = {
      generateChallenge: vi.fn().mockResolvedValue({
        nonce: 'abc123def456abc123def456',
        timestamp: 1700000000,
        expiresAt: 1700000300,
      }),
      verifyAndLogin: vi.fn().mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: { id: 'user-1', address: mockAddress, orgId: null, roleInOrg: 0 },
      }),
      refresh: vi.fn().mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
      logout: vi.fn().mockResolvedValue(undefined),
      generateCsrfToken: vi.fn().mockReturnValue('random.hmac'),
      verifyCsrfToken: vi.fn().mockReturnValue(true),
    };

    // Direct instantiation — avoids NestJS DI metadata issues in vitest
    controller = new AuthController(authService as unknown as AuthService);
  });

  // ─── GET /challenge ──────────────────────────────────────

  describe('GET /challenge', () => {
    it('returns challenge with nonce', async () => {
      const req = { ip: '127.0.0.1' } as any;
      const result = await controller.getChallenge(req);

      expect(result.nonce).toBe('abc123def456abc123def456');
      expect(result.timestamp).toBe(1700000000);
      expect(authService.generateChallenge).toHaveBeenCalledWith('127.0.0.1');
    });

    it('defaults to 0.0.0.0 when ip is undefined', async () => {
      const req = { ip: undefined } as any;
      await controller.getChallenge(req);
      expect(authService.generateChallenge).toHaveBeenCalledWith('0.0.0.0');
    });
  });

  // ─── POST /verify ────────────────────────────────────────

  describe('POST /verify', () => {
    it('returns access_token and sets refresh_token cookie', async () => {
      const dto = { address: mockAddress, signature: 'sig', nonce: 'n1' };
      const req = { ip: '10.0.0.1', headers: { 'user-agent': 'Test/1.0' } } as any;
      const res = {
        cookie: vi.fn(),
        json: vi.fn((body: any) => body),
      } as any;

      await controller.verify(dto, req, res);

      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'mock-refresh-token', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/v1/auth',
      });
      expect(res.json).toHaveBeenCalledWith({
        access_token: 'mock-access-token',
        user: { id: 'user-1', address: mockAddress, orgId: null, roleInOrg: 0 },
      });
    });
  });

  // ─── POST /logout ────────────────────────────────────────

  describe('POST /logout', () => {
    it('returns 204 and clears cookie when authenticated', async () => {
      const req = {
        user: { sid: 's1', jti: 'j1', exp: 9999999999 },
      } as any;
      const res = {
        clearCookie: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith('s1', 'j1', 9999999999);
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/v1/auth' });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('throws NOT_AUTHENTICATED when no user on request', async () => {
      const req = {} as any;
      const res = {} as any;

      await expect(controller.logout(req, res)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── GET /csrf-token ─────────────────────────────────────

  describe('GET /csrf-token', () => {
    it('returns csrf token', async () => {
      const result = await controller.getCsrfToken();
      expect(result.token).toBe('random.hmac');
      expect(authService.generateCsrfToken).toHaveBeenCalled();
    });
  });

  // ─── POST /refresh ───────────────────────────────────────

  describe('POST /refresh', () => {
    it('throws MISSING_REFRESH_TOKEN when no cookie', async () => {
      const req = { cookies: {}, headers: {} } as any;
      const res = {} as any;

      await expect(controller.refresh(req, res)).rejects.toThrow(UnauthorizedException);
    });

    it('throws MISSING_TOKEN when no Authorization header', async () => {
      const req = { cookies: { refresh_token: 'token' }, headers: {} } as any;
      const res = {} as any;

      await expect(controller.refresh(req, res)).rejects.toThrow(UnauthorizedException);
    });
  });
});
