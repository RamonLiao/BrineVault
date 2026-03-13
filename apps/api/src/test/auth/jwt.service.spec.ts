import { generateKeyPairSync } from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';

// Generate Ed25519 key pair for tests
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

// Set env vars BEFORE importing service
process.env.JWT_PRIVATE_KEY = Buffer.from(privatePem).toString('base64');
process.env.JWT_PUBLIC_KEY = Buffer.from(publicPem).toString('base64');
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.CSRF_SECRET = 'test-secret';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { JwtService } from '../../modules/auth/jwt.service.js';

describe('JwtService', () => {
  let jwtService: JwtService;

  beforeAll(async () => {
    jwtService = new JwtService();
    await jwtService.onModuleInit();
  });

  // --- Round-trip ---

  it('should sign and verify access token', async () => {
    const payload = {
      sub: 'user-1',
      address: '0x' + '0'.repeat(64),
      orgId: 'org-1',
      orgRole: 32,
      sid: 'sess-1',
    };
    const token = await jwtService.signAccessToken(payload);
    const verified = await jwtService.verifyAccessToken(token);

    expect(verified.sub).toBe('user-1');
    expect(verified.address).toBe('0x' + '0'.repeat(64));
    expect(verified.orgId).toBe('org-1');
    expect(verified.orgRole).toBe(32);
    expect(verified.sid).toBe('sess-1');
    expect(verified.jti).toBeDefined();
    expect(verified.iat).toBeDefined();
    expect(verified.exp).toBeDefined();
  });

  it('should sign token with null orgId', async () => {
    const payload = {
      sub: 'user-2',
      address: '0x' + 'a'.repeat(64),
      orgId: null,
      orgRole: 0,
      sid: 'sess-2',
    };
    const token = await jwtService.signAccessToken(payload);
    const verified = await jwtService.verifyAccessToken(token);

    expect(verified.sub).toBe('user-2');
    expect(verified.orgId).toBeNull();
  });

  it('should generate unique jti for each token', async () => {
    const payload = {
      sub: 'user-1',
      address: '0x' + '0'.repeat(64),
      orgId: 'org-1',
      orgRole: 32,
      sid: 'sess-1',
    };
    const token1 = await jwtService.signAccessToken(payload);
    const token2 = await jwtService.signAccessToken(payload);
    const v1 = await jwtService.verifyAccessToken(token1);
    const v2 = await jwtService.verifyAccessToken(token2);

    expect(v1.jti).not.toBe(v2.jti);
  });

  // --- Expired token ---

  it('should reject expired token', async () => {
    // Sign a token with 1s expiry, then wait
    const payload = {
      sub: 'user-1',
      address: '0x' + '0'.repeat(64),
      orgId: 'org-1',
      orgRole: 32,
      sid: 'sess-1',
    };
    const token = await jwtService.signAccessToken(payload, '1s');
    // Wait for expiry
    await new Promise((r) => setTimeout(r, 1500));
    await expect(jwtService.verifyAccessToken(token)).rejects.toThrow();
  });

  // --- Tampered token ---

  it('should reject tampered token', async () => {
    const payload = {
      sub: 'user-1',
      address: '0x' + '0'.repeat(64),
      orgId: 'org-1',
      orgRole: 32,
      sid: 'sess-1',
    };
    const token = await jwtService.signAccessToken(payload);
    // Tamper with the payload (middle part)
    const parts = token.split('.');
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    decoded.sub = 'hacked';
    parts[1] = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const tampered = parts.join('.');

    await expect(jwtService.verifyAccessToken(tampered)).rejects.toThrow();
  });

  // --- Refresh token ---

  it('should generate refresh token as hex string', () => {
    const token = jwtService.generateRefreshToken();
    expect(token).toHaveLength(128); // 64 bytes = 128 hex chars
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('should hash refresh token consistently', () => {
    const token = jwtService.generateRefreshToken();
    const hash1 = jwtService.hashRefreshToken(token);
    const hash2 = jwtService.hashRefreshToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
  });

  it('should produce different hashes for different tokens', () => {
    const t1 = jwtService.generateRefreshToken();
    const t2 = jwtService.generateRefreshToken();
    expect(jwtService.hashRefreshToken(t1)).not.toBe(jwtService.hashRefreshToken(t2));
  });

  // --- Monkey / edge cases ---

  it('should reject completely invalid string', async () => {
    await expect(jwtService.verifyAccessToken('not-a-jwt')).rejects.toThrow();
  });

  it('should reject empty string', async () => {
    await expect(jwtService.verifyAccessToken('')).rejects.toThrow();
  });

  it('should reject token signed with different key', async () => {
    const { privateKey: otherPriv } = generateKeyPairSync('ed25519');
    const otherPem = otherPriv.export({ type: 'pkcs8', format: 'pem' }) as string;
    const { importPKCS8, SignJWT } = await import('jose');
    const otherKey = await importPKCS8(otherPem, 'EdDSA');

    const fakeToken = await new SignJWT({ sub: 'user-1', jti: 'fake' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(otherKey);

    await expect(jwtService.verifyAccessToken(fakeToken)).rejects.toThrow();
  });

  it('should handle refresh token hash of empty string without crashing', () => {
    const hash = jwtService.hashRefreshToken('');
    expect(hash).toHaveLength(64);
  });
});
