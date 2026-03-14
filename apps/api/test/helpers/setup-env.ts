/**
 * Vitest setupFile — runs before any test file is loaded.
 * Sets process.env so loadEnv() picks up test values on first call.
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

process.env.PORT = '0';
process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_PRIVATE_KEY = Buffer.from(
  privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
).toString('base64');
process.env.JWT_PUBLIC_KEY = Buffer.from(
  publicKey.export({ type: 'spki', format: 'pem' }) as string,
).toString('base64');
process.env.CSRF_SECRET = 'e2e-test-csrf-secret-minimum-32-chars-long';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.SUI_RPC_URL = 'https://fullnode.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0000000000000000000000000000000000000000000000000000000000000000';
process.env.PLATFORM_KEYPAIR = 'dGVzdC1wbGF0Zm9ybS1rZXlwYWly';
