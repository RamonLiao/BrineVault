import Redis from "ioredis";
import { createDb } from "@rwa-dataroom/db";
import { loadConfig } from "./config.js";
import { SuiEventPoller } from "./sui-client.js";
import { CacheInvalidator } from "./cache-invalidator.js";
import { buildEventHandlerMap } from "./event-handlers/index.js";
import { Indexer } from "./indexer.js";
import { startHealthServer } from "./health.js";

async function main() {
  const config = loadConfig();
  console.log("[indexer] Starting with config:", {
    suiRpcUrl: config.suiRpcUrl,
    packageId: config.packageId,
    chainId: config.chainId,
    healthPort: config.healthPort,
  });

  // Database
  const { db } = createDb({ url: config.databaseUrl });

  // Redis (optional — graceful degradation if unavailable)
  let redis: Redis | null = null;
  try {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    await redis.connect();
    console.log("[indexer] Redis connected");
  } catch (err) {
    console.warn("[indexer] Redis unavailable, cache invalidation disabled:", err);
    redis = null;
  }

  // Event source
  const eventSource = new SuiEventPoller(config);

  // Handler map
  const handlerMap = buildEventHandlerMap(config.packageId);

  // Cache invalidator
  const cache = new CacheInvalidator(redis);

  // Indexer
  const indexer = new Indexer({
    db,
    eventSource,
    handlerMap,
    cache,
    chainId: config.chainId,
    pollIntervalMs: config.pollIntervalMs,
  });

  // Health check server
  const healthServer = startHealthServer(config.healthPort, indexer.getCursorManager());

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[indexer] Shutting down...");
    await indexer.stop();
    healthServer.close();
    if (redis) await redis.quit();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start processing
  await indexer.start();
}

main().catch((err) => {
  console.error("[indexer] Fatal error:", err);
  process.exit(1);
});

export { Indexer } from "./indexer.js";
export { CursorManager } from "./cursor-manager.js";
export { CacheInvalidator } from "./cache-invalidator.js";
export { buildEventHandlerMap } from "./event-handlers/index.js";
export type { EventContext, EventHandler } from "./event-handlers/types.js";
