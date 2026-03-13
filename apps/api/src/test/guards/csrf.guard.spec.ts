import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';

function mockExecutionContext(overrides: {
  method: string;
  headers?: Record<string, string>;
  isPublic?: boolean;
}): ExecutionContext {
  const request = {
    method: overrides.method,
    headers: overrides.headers ?? {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let reflector: Reflector;
  let mockAuthService: {
    verifyCsrfToken: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    reflector = new Reflector();
    mockAuthService = {
      verifyCsrfToken: vi.fn(),
    };
    guard = new CsrfGuard(reflector, mockAuthService as any);
  });

  it('should pass GET requests without CSRF check', () => {
    const ctx = mockExecutionContext({ method: 'GET' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass HEAD requests without CSRF check', () => {
    const ctx = mockExecutionContext({ method: 'HEAD' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass OPTIONS requests without CSRF check', () => {
    const ctx = mockExecutionContext({ method: 'OPTIONS' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass public POST routes (skip CSRF)', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true);
    const ctx = mockExecutionContext({ method: 'POST' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should pass POST with valid CSRF token', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    mockAuthService.verifyCsrfToken.mockReturnValue(true);

    const ctx = mockExecutionContext({
      method: 'POST',
      headers: { 'x-csrf-token': 'valid-token.hmac' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw 403 on POST without CSRF token', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    const ctx = mockExecutionContext({ method: 'POST', headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw 403 on POST with invalid CSRF token', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    mockAuthService.verifyCsrfToken.mockReturnValue(false);

    const ctx = mockExecutionContext({
      method: 'POST',
      headers: { 'x-csrf-token': 'bad-token' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should enforce CSRF on PATCH method', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    const ctx = mockExecutionContext({ method: 'PATCH', headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should enforce CSRF on DELETE method', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    const ctx = mockExecutionContext({ method: 'DELETE', headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  // --- Monkey tests ---

  it('should reject empty string CSRF token', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);
    mockAuthService.verifyCsrfToken.mockReturnValue(false);

    const ctx = mockExecutionContext({
      method: 'POST',
      headers: { 'x-csrf-token': '' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should reject PUT method without CSRF', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(false);

    const ctx = mockExecutionContext({ method: 'PUT', headers: {} });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
