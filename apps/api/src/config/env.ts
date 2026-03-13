import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY is required (base64 PKCS8 Ed25519)'),
  JWT_PUBLIC_KEY: z.string().min(1, 'JWT_PUBLIC_KEY is required (base64 SPKI Ed25519)'),
  CSRF_SECRET: z.string().min(1, 'CSRF_SECRET is required'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SUI_RPC_URL: z.string().url(),
  SUI_PACKAGE_ID: z.string().min(1, 'SUI_PACKAGE_ID is required'),
  PLATFORM_KEYPAIR: z.string().min(1, 'PLATFORM_KEYPAIR is required (base64)'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(): Env {
  if (cachedEnv) return cachedEnv;
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}
