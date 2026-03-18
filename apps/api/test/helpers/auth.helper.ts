import type { INestApplication } from '@nestjs/common';
import { randomUUID, randomBytes } from 'node:crypto';
import { JwtService } from '../../src/modules/auth/jwt.service.js';
import { SessionService } from '../../src/modules/auth/session.service.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';

export interface AuthUser {
  accessToken: string;
  refreshToken: string;
  userId: string;
  address: string;
  orgId: string | null;
  orgRole: number;
  sid: string;
}

export class AuthHelper {
  private jwtService: JwtService;
  private sessionService: SessionService;
  private authService: AuthService;

  constructor(app: INestApplication) {
    this.jwtService = app.get(JwtService);
    this.sessionService = app.get(SessionService);
    this.authService = app.get(AuthService);
  }

  /**
   * Creates a fully authenticated user with a valid JWT + Redis session.
   * No Sui signature needed — bypasses verify flow for convenience.
   */
  async createAuthenticatedUser(overrides?: {
    sub?: string;
    address?: string;
    orgId?: string | null;
    orgRole?: number;
  }): Promise<AuthUser> {
    const userId = overrides?.sub ?? randomUUID();
    const address =
      overrides?.address ?? '0x' + randomBytes(32).toString('hex');
    const orgId = overrides?.orgId ?? null;
    const orgRole = overrides?.orgRole ?? 0;

    const refreshToken = this.jwtService.generateRefreshToken();
    const refreshTokenHash = this.jwtService.hashRefreshToken(refreshToken);

    const sid = await this.sessionService.createSession(
      userId,
      address,
      orgId,
      refreshTokenHash,
      '127.0.0.1',
      'e2e-test-agent',
    );

    const accessToken = await this.jwtService.signAccessToken({
      sub: userId,
      address,
      orgId,
      orgRole,
      sid,
    });

    return { accessToken, refreshToken, userId, address, orgId, orgRole, sid };
  }

  /** Generate a valid CSRF token for mutation requests. */
  getCsrfToken(): string {
    return this.authService.generateCsrfToken();
  }
}
