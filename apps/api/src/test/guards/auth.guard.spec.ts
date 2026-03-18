import { describe, it, expect, beforeAll, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { JwtService } from '../../modules/auth/jwt.service.js';
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';

// ---------- helpers ----------

function mockExecutionContext(overrides: {
  headers?: Record<string, string>;
  isPublic?: boolean;
}): ExecutionContext {
  const request = {
    headers: overrides.headers ?? {},
    user: undefined as any,
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    __request: request, // expose for assertions
  } as any;
}

// ---------- suite ----------

describe('AuthGuard', () => {
  let jwtService: JwtService;
  let guard: AuthGuard;
  let reflector: Reflector;
  let mockSessionService: {
    isTokenBlacklisted: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    // Generate real Ed25519 keys for testing
    const { privateKey, publicKey } = await generateKeyPair('EdDSA', { extractable: true });
    const pkcs8Pem = await exportPKCS8(privateKey);
    const spkiPem = await exportSPKI(publicKey);

    process.env.JWT_PRIVATE_KEY = Buffer.from(pkcs8Pem).toString('base64');
    process.env.JWT_PUBLIC_KEY = Buffer.from(spkiPem).toString('base64');
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.REDIS_URL = 'redis://localhost';
    process.env.CSRF_SECRET = 'test-csrf-secret';
    process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
    process.env.SUI_PACKAGE_ID = '0x0';
    process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

    jwtService = new JwtService();
    await jwtService.onModuleInit();

    mockSessionService = {
      isTokenBlacklisted: vi.fn().mockResolvedValue(false),
      getSession: vi.fn().mockResolvedValue({ userId: 'u1' }),
    };

    reflector = new Reflector();
    guard = new AuthGuard(reflector, jwtService, mockSessionService as any);
  });

  it('should pass when route is @Public()', async () => {
    const ctx = mockExecutionContext({ isPublic: true });
    // Mock reflector to return isPublic=true
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should attach user to request on valid token', async () => {
    const token = await jwtService.signAccessToken({
      sub: 'user-1',
      address: '0xabc',
      orgId: null,
      orgRole: 0,
      sid: 'session-1',
    });

    const ctx = mockExecutionContext({
      headers: { authorization: `Bearer ${token}` },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    mockSessionService.isTokenBlacklisted.mockResolvedValueOnce(false);
    mockSessionService.getSession.mockResolvedValueOnce({ userId: 'user-1' });

    expect(await guard.canActivate(ctx)).toBe(true);
    expect((ctx as any).__request.user).toBeDefined();
    expect((ctx as any).__request.user.sub).toBe('user-1');
  });

  it('should throw 401 when no token', async () => {
    const ctx = mockExecutionContext({ headers: {} });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    try {
      await guard.canActivate(ctx);
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      expect(e.response.code).toBe('MISSING_TOKEN');
    }
  });

  it('should throw 401 on expired token', async () => {
    const token = await jwtService.signAccessToken(
      { sub: 'user-1', address: '0xabc', orgId: null, orgRole: 0, sid: 's1' },
      '0s', // expires immediately
    );
    // Small delay to ensure expiry
    await new Promise((r) => setTimeout(r, 50));

    const ctx = mockExecutionContext({
      headers: { authorization: `Bearer ${token}` },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    try {
      await guard.canActivate(ctx);
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      expect(e.response.code).toBe('INVALID_TOKEN');
    }
  });

  it('should throw 401 when token is blacklisted', async () => {
    const token = await jwtService.signAccessToken({
      sub: 'user-1',
      address: '0xabc',
      orgId: null,
      orgRole: 0,
      sid: 's1',
    });

    const ctx = mockExecutionContext({
      headers: { authorization: `Bearer ${token}` },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    mockSessionService.isTokenBlacklisted.mockResolvedValueOnce(true);

    try {
      await guard.canActivate(ctx);
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      expect(e.response.code).toBe('TOKEN_REVOKED');
    }
  });

  it('should throw 401 when session is expired/missing', async () => {
    const token = await jwtService.signAccessToken({
      sub: 'user-1',
      address: '0xabc',
      orgId: null,
      orgRole: 0,
      sid: 's1',
    });

    const ctx = mockExecutionContext({
      headers: { authorization: `Bearer ${token}` },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    mockSessionService.isTokenBlacklisted.mockResolvedValueOnce(false);
    mockSessionService.getSession.mockResolvedValueOnce(null);

    try {
      await guard.canActivate(ctx);
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      expect(e.response.code).toBe('SESSION_EXPIRED');
    }
  });

  // --- Monkey tests ---

  it('should reject malformed Bearer value', async () => {
    const ctx = mockExecutionContext({
      headers: { authorization: 'Bearer not.a.valid.jwt' },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('should reject authorization header without Bearer prefix', async () => {
    const ctx = mockExecutionContext({
      headers: { authorization: 'Basic abc123' },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    try {
      await guard.canActivate(ctx);
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect(e).toBeInstanceOf(UnauthorizedException);
      expect(e.response.code).toBe('MISSING_TOKEN');
    }
  });

  it('should reject empty Bearer token', async () => {
    const ctx = mockExecutionContext({
      headers: { authorization: 'Bearer ' },
    });
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
