export interface IndexerConfig {
  /** Sui RPC URL */
  suiRpcUrl: string;
  /** Move package ID to subscribe events from */
  packageId: string;
  /** Database connection URL */
  databaseUrl: string;
  /** Redis connection URL */
  redisUrl: string;
  /** Chain ID for checkpoint tracking */
  chainId: string;
  /** Polling interval in ms (used when no WebSocket available) */
  pollIntervalMs: number;
  /** Health check port */
  healthPort: number;
}

export function loadConfig(): IndexerConfig {
  return {
    suiRpcUrl: process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
    packageId: process.env.SUI_PACKAGE_ID ?? "0x0",
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/rwa_dataroom",
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    chainId: process.env.CHAIN_ID ?? "sui:testnet",
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "2000"),
    healthPort: Number(process.env.HEALTH_PORT ?? "3001"),
  };
}
