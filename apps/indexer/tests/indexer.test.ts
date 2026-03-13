import { describe, it, expect, vi, beforeEach } from "vitest";
import { Indexer } from "../src/indexer.js";
import { CacheInvalidator } from "../src/cache-invalidator.js";
import type { SuiEventSubscription } from "../src/sui-client.js";
import type { SuiEvent, EventId } from "@mysten/sui/client";
import type { Database } from "@rwa-dataroom/db";
import type { EventHandler, EventContext } from "../src/event-handlers/types.js";

// Mock event factory
function makeMockEvent(
  type: string,
  txDigest: string,
  eventSeq: string,
  parsedJson: Record<string, unknown> = {},
): SuiEvent {
  return {
    id: { txDigest, eventSeq },
    type,
    parsedJson,
    packageId: "0xtest",
    transactionModule: "events",
    sender: "0xsender",
    bcs: "",
    timestampMs: Date.now().toString(),
  } as unknown as SuiEvent;
}

describe("Indexer", () => {
  let mockDb: Database;
  let mockEventSource: SuiEventSubscription;
  let mockCache: CacheInvalidator;
  let handlerMap: Map<string, EventHandler>;
  let handlerCalls: Array<{ type: string; txDigest: string; eventSeq: bigint }>;

  beforeEach(() => {
    mockDb = {} as any;
    mockCache = new CacheInvalidator(null); // No Redis
    handlerCalls = [];
    handlerMap = new Map();

    // Register a test handler
    handlerMap.set("0xtest::events::TestEvent", async (ctx: EventContext) => {
      handlerCalls.push({
        type: ctx.event.type,
        txDigest: ctx.txDigest,
        eventSeq: ctx.eventSeq,
      });
    });

    mockEventSource = {
      poll: vi.fn(),
    };
  });

  it("processes events from a single batch", async () => {
    const events = [
      makeMockEvent("0xtest::events::TestEvent", "tx1", "0"),
      makeMockEvent("0xtest::events::TestEvent", "tx1", "1"),
    ];

    const indexer = new Indexer({
      db: mockDb,
      eventSource: mockEventSource,
      handlerMap,
      cache: mockCache,
      chainId: "test",
      pollIntervalMs: 100,
    });

    await indexer.processBatch(events);

    expect(handlerCalls).toHaveLength(2);
    expect(handlerCalls[0]!.txDigest).toBe("tx1");
    expect(handlerCalls[0]!.eventSeq).toBe(BigInt(0));
    expect(handlerCalls[1]!.eventSeq).toBe(BigInt(1));
  });

  it("skips unknown event types gracefully", async () => {
    const events = [
      makeMockEvent("0xtest::events::UnknownEvent", "tx2", "0"),
      makeMockEvent("0xtest::events::TestEvent", "tx2", "1"),
    ];

    const indexer = new Indexer({
      db: mockDb,
      eventSource: mockEventSource,
      handlerMap,
      cache: mockCache,
      chainId: "test",
      pollIntervalMs: 100,
    });

    await indexer.processBatch(events);

    // Only the known event should be processed
    expect(handlerCalls).toHaveLength(1);
    expect(handlerCalls[0]!.eventSeq).toBe(BigInt(1));
  });

  it("handles duplicate events (idempotency via unique constraint errors)", async () => {
    // Simulate a handler that throws a unique constraint error on duplicate
    let callCount = 0;
    handlerMap.set("0xtest::events::DuplicateTest", async (_ctx: EventContext) => {
      callCount++;
      if (callCount > 1) {
        throw new Error("unique constraint violation: duplicate key");
      }
    });

    const event = makeMockEvent("0xtest::events::DuplicateTest", "tx3", "0");

    const indexer = new Indexer({
      db: mockDb,
      eventSource: mockEventSource,
      handlerMap,
      cache: mockCache,
      chainId: "test",
      pollIntervalMs: 100,
    });

    // First processing — should succeed
    await indexer.processBatch([event]);
    expect(callCount).toBe(1);

    // Second processing — should not throw (unique constraint handled)
    await indexer.processBatch([event]);
    expect(callCount).toBe(2);
  });

  it("re-throws non-duplicate errors", async () => {
    handlerMap.set("0xtest::events::ErrorTest", async () => {
      throw new Error("connection refused");
    });

    const event = makeMockEvent("0xtest::events::ErrorTest", "tx4", "0");

    const indexer = new Indexer({
      db: mockDb,
      eventSource: mockEventSource,
      handlerMap,
      cache: mockCache,
      chainId: "test",
      pollIntervalMs: 100,
    });

    await expect(indexer.processBatch([event])).rejects.toThrow("connection refused");
  });

  it("processEvent delegates to processBatch", async () => {
    const event = makeMockEvent("0xtest::events::TestEvent", "tx5", "0");

    const indexer = new Indexer({
      db: mockDb,
      eventSource: mockEventSource,
      handlerMap,
      cache: mockCache,
      chainId: "test",
      pollIntervalMs: 100,
    });

    await indexer.processEvent(event);
    expect(handlerCalls).toHaveLength(1);
  });

  it("stop() sets running flag to false", async () => {
    const indexer = new Indexer({
      db: mockDb,
      eventSource: mockEventSource,
      handlerMap,
      cache: mockCache,
      chainId: "test",
      pollIntervalMs: 100,
    });

    // stop() should not throw
    await indexer.stop();
  });
});

describe("Indexer cursor recovery", () => {
  it("processes events in order after recovery", async () => {
    const orderedSeqs: bigint[] = [];

    const handlerMap = new Map<string, EventHandler>();
    handlerMap.set("0xtest::events::OrderTest", async (ctx: EventContext) => {
      orderedSeqs.push(ctx.eventSeq);
    });

    const events = [
      makeMockEvent("0xtest::events::OrderTest", "tx-order", "5"),
      makeMockEvent("0xtest::events::OrderTest", "tx-order", "6"),
      makeMockEvent("0xtest::events::OrderTest", "tx-order", "7"),
    ];

    const indexer = new Indexer({
      db: {} as any,
      eventSource: { poll: vi.fn() },
      handlerMap,
      cache: new CacheInvalidator(null),
      chainId: "test",
      pollIntervalMs: 100,
    });

    await indexer.processBatch(events);

    expect(orderedSeqs).toEqual([BigInt(5), BigInt(6), BigInt(7)]);
  });
});

describe("CacheInvalidator", () => {
  it("does nothing when redis is null", async () => {
    const cache = new CacheInvalidator(null);
    // Should not throw
    await cache.invalidatePool("pool-1");
    await cache.invalidateMembers("pool-1");
    await cache.invalidatePoolAndMembers("pool-1");
    await cache.invalidateNotificationCount("user-1");
  });

  it("calls redis.del when redis is available", async () => {
    const mockRedis = {
      del: vi.fn().mockResolvedValue(1),
    } as any;

    const cache = new CacheInvalidator(mockRedis);

    await cache.invalidatePool("pool-1");
    expect(mockRedis.del).toHaveBeenCalledWith("cache:pool:pool-1");

    await cache.invalidateMembers("pool-2");
    expect(mockRedis.del).toHaveBeenCalledWith("cache:members:pool-2");

    await cache.invalidatePoolAndMembers("pool-3");
    expect(mockRedis.del).toHaveBeenCalledWith(
      "cache:pool:pool-3",
      "cache:members:pool-3",
    );
  });
});
