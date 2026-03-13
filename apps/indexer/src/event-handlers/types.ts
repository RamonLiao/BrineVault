import type { SuiEvent } from "@mysten/sui/client";
import type { Database } from "@rwa-dataroom/db";
import type { CacheInvalidator } from "../cache-invalidator.js";

/**
 * Parsed event fields from Sui JSON-RPC.
 * parsedJson is the event struct fields as a JS object.
 */
export interface EventContext {
  event: SuiEvent;
  db: Database;
  cache: CacheInvalidator;
  txDigest: string;
  eventSeq: bigint;
}

export type EventHandler = (ctx: EventContext) => Promise<void>;
