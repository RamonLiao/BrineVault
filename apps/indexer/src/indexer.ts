import type { SuiEvent, EventId } from "@mysten/sui/client";
import type { Database } from "@rwa-dataroom/db";
import type { SuiEventSubscription } from "./sui-client.js";
import { CursorManager } from "./cursor-manager.js";
import { CacheInvalidator } from "./cache-invalidator.js";
import type { EventHandler, EventContext } from "./event-handlers/types.js";

export interface IndexerDeps {
  db: Database;
  eventSource: SuiEventSubscription;
  handlerMap: Map<string, EventHandler>;
  cache: CacheInvalidator;
  chainId: string;
  pollIntervalMs: number;
}

/**
 * Core indexer loop.
 * Polls events from Sui, dispatches to handlers, persists cursor.
 */
export class Indexer {
  private cursorManager: CursorManager;
  private running = false;
  private deps: IndexerDeps;

  constructor(deps: IndexerDeps) {
    this.deps = deps;
    this.cursorManager = new CursorManager(deps.db, deps.chainId);
  }

  getCursorManager(): CursorManager {
    return this.cursorManager;
  }

  async start(): Promise<void> {
    this.running = true;
    console.log("[indexer] Starting event processing loop...");

    let cursor = await this.cursorManager.loadCursor();
    console.log(`[indexer] Loaded cursor: ${cursor ? JSON.stringify(cursor) : "null (start from beginning)"}`);

    while (this.running) {
      try {
        const result = await this.deps.eventSource.poll(cursor);

        if (result.events.length > 0) {
          await this.processBatch(result.events);

          if (result.nextCursor) {
            const lastEvent = result.events[result.events.length - 1]!;
            const eventSeq = BigInt(lastEvent.id.eventSeq);
            await this.cursorManager.saveCursor(
              result.nextCursor,
              lastEvent.id.txDigest,
              eventSeq,
            );
            cursor = result.nextCursor;
          }

          console.log(`[indexer] Processed ${result.events.length} events`);
        }

        // If there's more data, continue immediately
        if (result.hasNextPage) continue;

        // Otherwise wait before next poll
        await this.sleep(this.deps.pollIntervalMs);
      } catch (err) {
        console.error("[indexer] Error in processing loop:", err);
        await this.sleep(this.deps.pollIntervalMs * 2);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    console.log("[indexer] Stopping...");
  }

  /**
   * Process a batch of events. Each event is dispatched to the matching handler.
   * Processing is idempotent via unique constraints on (sui_tx_digest, sui_event_seq).
   */
  async processBatch(events: SuiEvent[]): Promise<void> {
    for (const event of events) {
      const handler = this.deps.handlerMap.get(event.type);
      if (!handler) {
        // Unknown event type — skip (could be FolderCreated, AdminPauseToggled, etc.)
        continue;
      }

      const ctx: EventContext = {
        event,
        db: this.deps.db,
        cache: this.deps.cache,
        txDigest: event.id.txDigest,
        eventSeq: BigInt(event.id.eventSeq),
      };

      try {
        await handler(ctx);
      } catch (err) {
        // Check if it's a unique constraint violation (idempotency)
        const errStr = String(err);
        if (errStr.includes("unique") || errStr.includes("duplicate")) {
          console.log(
            `[indexer] Duplicate event skipped: ${event.type} tx=${event.id.txDigest} seq=${event.id.eventSeq}`,
          );
        } else {
          console.error(
            `[indexer] Error processing event ${event.type}:`,
            err,
          );
          throw err; // Re-throw non-idempotency errors
        }
      }
    }
  }

  /**
   * Process a single event — useful for testing.
   */
  async processEvent(event: SuiEvent): Promise<void> {
    await this.processBatch([event]);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
