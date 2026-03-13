import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type DbConfig = {
  url: string;
  maxConnections?: number;
  idleTimeout?: number;
};

const DEFAULT_CONFIG: Partial<DbConfig> = {
  maxConnections: 10,
  idleTimeout: 20,
};

/**
 * Create a Drizzle database client from a connection URL.
 */
export function createDb(config: DbConfig) {
  const merged = { ...DEFAULT_CONFIG, ...config };
  const sql = postgres(merged.url, {
    max: merged.maxConnections,
    idle_timeout: merged.idleTimeout,
  });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export type Database = ReturnType<typeof createDb>["db"];
