import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { JwtService } from './jwt.service.js';
import { SessionService } from './session.service.js';
import { UsersRepository } from '@rwa-dataroom/db';
import { AUTH_CONFIG } from '@rwa-dataroom/shared';
import type { AuthChallenge } from '@rwa-dataroom/shared';
import { loadEnv } from '../../config/env.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    @Inject(UsersRepository) private readonly usersRepo: UsersRepository,
  ) {}

  async generateChallenge(ip: string): Promise<AuthChallenge> {
    const nonce = randomBytes(12).toString('hex');
    await this.sessionService.storeChallenge(nonce, ip);
    const now = Math.floor(Date.now() / 1000);
    return {
      nonce,
      timestamp: now,
      expiresAt: now + AUTH_CONFIG.CHALLENGE_TTL_SECONDS,
    };
  }

  async verifyAndLogin(
    dto: { address: string; signature: string; nonce: string },
    ip: string,
    userAgent: string,
  ) {
    // 1. Consume nonce (atomic)
    const challengeData = await this.sessionService.consumeChallenge(dto.nonce);
    if (!challengeData) {
      throw new UnauthorizedException({ code: 'INVALID_NONCE', message: 'Invalid or expired nonce' });
    }

    // 2. Verify signature
    const message = `Sign in to RWA Data Room\nNonce: ${dto.nonce}\nTimestamp: ${challengeData.timestamp}`;
    const messageBytes = new TextEncoder().encode(message);

    try {
      const { verifyPersonalMessageSignature } = await import('@mysten/sui/verify');
      const publicKey = await verifyPersonalMessageSignature(messageBytes, dto.signature);
      const recoveredAddress = publicKey.toSuiAddress();
      if (recoveredAddress !== dto.address) {
        throw new UnauthorizedException({ code: 'INVALID_SIGNATURE', message: 'Signature address mismatch' });
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({ code: 'INVALID_SIGNATURE', message: 'Signature verification failed' });
    }

    // 3. Upsert user
    const [user] = await this.usersRepo.upsertByWallet({ primaryWalletAddress: dto.address });

    // 4. Generate refresh token + hash
    const refreshToken = this.jwtService.generateRefreshToken();
    const refreshTokenHash = this.jwtService.hashRefreshToken(refreshToken);

    // 5. Create session
    const sid = await this.sessionService.createSession(
      user.id,
      dto.address,
      user.orgId ?? null,
      refreshTokenHash,
      ip,
      userAgent,
    );

    // 6. Sign JWT
    const accessToken = await this.jwtService.signAccessToken({
      sub: user.id,
      address: dto.address,
      orgId: user.orgId ?? null,
      orgRole: user.roleInOrg ?? 0,
      sid,
    });

    // 7. Return
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        address: dto.address,
        orgId: user.orgId ?? null,
        roleInOrg: user.roleInOrg ?? 0,
      },
    };
  }

  async refresh(refreshToken: string, sid: string) {
    // 1. Hash incoming refresh token
    const incomingHash = this.jwtService.hashRefreshToken(refreshToken);

    // 2. Get session
    const session = await this.sessionService.getSession(sid);
    if (!session) {
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Session expired or not found' });
    }

    // 3. Compare hashes — detect reuse
    if (session.refreshTokenHash !== incomingHash) {
      // Token reuse attack! Destroy the session.
      await this.sessionService.deleteSession(sid);
      throw new UnauthorizedException({ code: 'TOKEN_REUSE_DETECTED', message: 'Refresh token reuse detected' });
    }

    // 4. Generate new refresh token
    const newRefreshToken = this.jwtService.generateRefreshToken();
    const newHash = this.jwtService.hashRefreshToken(newRefreshToken);

    // 5. Update session
    await this.sessionService.updateSession(sid, newHash);

    // 6. Sign new access token
    const accessToken = await this.jwtService.signAccessToken({
      sub: session.userId,
      address: session.address,
      orgId: session.orgId,
      orgRole: 0,
      sid,
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(sid: string, jti: string, exp: number) {
    await this.sessionService.deleteSession(sid);
    const remaining = exp - Math.floor(Date.now() / 1000);
    if (remaining > 0) {
      await this.sessionService.blacklistToken(jti, remaining);
    }
  }

  generateCsrfToken(): string {
    const env = loadEnv();
    const random = randomBytes(32).toString('hex');
    const hmac = createHmac('sha256', env.CSRF_SECRET).update(random).digest('hex');
    return `${random}.${hmac}`;
  }

  verifyCsrfToken(token: string): boolean {
    const env = loadEnv();
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [random, providedHmac] = parts;
    const expectedHmac = createHmac('sha256', env.CSRF_SECRET).update(random).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(providedHmac, 'hex'), Buffer.from(expectedHmac, 'hex'));
    } catch {
      return false;
    }
  }
}
