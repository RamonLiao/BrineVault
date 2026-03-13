import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type CryptoKey, type KeyObject } from 'jose';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { loadEnv } from '../../config/env.js';
import type { JwtPayload } from '@rwa-dataroom/shared';

@Injectable()
export class JwtService {
  private privateKey!: CryptoKey | KeyObject;
  private publicKey!: CryptoKey | KeyObject;

  async onModuleInit() {
    const env = loadEnv();
    const pkcs8Pem = Buffer.from(env.JWT_PRIVATE_KEY, 'base64').toString('utf-8');
    const spkiPem = Buffer.from(env.JWT_PUBLIC_KEY, 'base64').toString('utf-8');
    this.privateKey = await importPKCS8(pkcs8Pem, 'EdDSA');
    this.publicKey = await importSPKI(spkiPem, 'EdDSA');
  }

  async signAccessToken(
    payload: Omit<JwtPayload, 'jti' | 'iat' | 'exp'>,
    expiresIn = '15m',
  ): Promise<string> {
    return new SignJWT({ ...payload, jti: randomUUID() } as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.privateKey);
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const { payload } = await jwtVerify(token, this.publicKey, { algorithms: ['EdDSA'] });
    return payload as unknown as JwtPayload;
  }

  generateRefreshToken(): string {
    return randomBytes(64).toString('hex');
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
