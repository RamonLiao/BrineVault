import { describe, it, expect, vi } from "vitest";
import { Indexer } from "../src/indexer.js";
import { CacheInvalidator } from "../src/cache-invalidator.js";
import type { EventHandler, EventContext } from "../src/event-handlers/types.js";
import type { SuiEvent } from "@mysten/sui/client";

function makeMockEvent(
  type: string,
  txDigest: string,
  eventSeq: string,
): SuiEvent {
  return {
    id: { txDigest, eventSeq },
    type,
    parsedJson: {},
    packageId: "0xtest",
    transactionModule: "events",
    sender: "0xsender",
    bcs: "",
    timestampMs: Date.now().toString(),
  } as unknown as SuiEvent;
}

describe("Monkey tests — Indexer edge cases", () => {
  it("handles empty event batch gracefully", async () => {
    const handlerMap = new Map<string, EventHandler>();
    const indexer = new Indexer({
      db: {} as any,
      eventSource: { poll: vi.fn() },
      handlerMap,
      cache: new CacheInvalidator(null),
      chainId: "test",
      pollIntervalMs: 100,
    });

    // Should not throw
    await indexer.processBatch([]);
  });

  it("handles massive batch of 1000 events", async () => {
    let processedCount = 0;
    const handlerMap = new Map<string, EventHandler>();
    handlerMap.set("0xtest::events::Bulk", async () => {
      processedCount++;
    });

    const events = Array.from({ length: 1000 }, (_, i) =>
      makeMockEvent("0xtest::events::Bulk", `tx-bulk-${i}`, String(i)),
    );

    const indexer = new Indexer({
      db: {} as any,
      eventSource: { poll: vi.fn() },
      handlerMap,
      cache: new CacheInvalidator(null),
      chainId: "test",
      pollIntervalMs: 100,
    });

    await indexer.processBatch(events);
    expect(processedCount).toBe(1000);
  });

  it("handles events with same txDigest but different eventSeq", async () => {
    const seqs: bigint[] = [];
    const handlerMap = new Map<string, EventHandler>();
    handlerMap.set("0xtest::events::SameTx", async (ctx) => {
      seqs.push(ctx.eventSeq);
    });

    const events = [
      makeMockEvent("0xtest::events::SameTx", "same-tx", "0"),
      makeMockEvent("0xtest::events::SameTx", "same-tx", "1"),
      makeMockEvent("0xtest::events::SameTx", "same-tx", "2"),
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
    expect(seqs).toEqual([BigInt(0), BigInt(1), BigInt(2)]);
  });

  it("handles interleaved known and unknown event types", async () => {
    const processed: string[] = [];
    const handlerMap = new Map<string, EventHandler>();
    handlerMap.set("0xtest::events::Known", async (ctx) => {
      processed.push(ctx.event.type);
    });

    const events = [
      makeMockEvent("0xtest::events::Unknown1", "tx-mix", "0"),
      makeMockEvent("0xtest::events::Known", "tx-mix", "1"),
      makeMockEvent("0xtest::events::Unknown2", "tx-mix", "2"),
      makeMockEvent("0xtest::events::Known", "tx-mix", "3"),
      makeMockEvent("0xtest::events::Unknown3", "tx-mix", "4"),
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
    expect(processed).toHaveLength(2);
  });

  it("handles handler that takes varying time to complete", async () => {
    const completionOrder: number[] = [];
    const handlerMap = new Map<string, EventHandler>();
    handlerMap.set("0xtest::events::Slow", async (ctx) => {
      const seq = Number(ctx.eventSeq);
      // Simulate varying processing time
      await new Promise((r) => setTimeout(r, Math.random() * 10));
      completionOrder.push(seq);
    });

    const events = Array.from({ length: 10 }, (_, i) =>
      makeMockEvent("0xtest::events::Slow", `tx-slow-${i}`, String(i)),
    );

    const indexer = new Indexer({
      db: {} as any,
      eventSource: { poll: vi.fn() },
      handlerMap,
      cache: new CacheInvalidator(null),
      chainId: "test",
      pollIntervalMs: 100,
    });

    await indexer.processBatch(events);

    // Since processBatch processes sequentially, order must be preserved
    expect(completionOrder).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("stops processing on first non-idempotency error in batch", async () => {
    let processedCount = 0;
    const handlerMap = new Map<string, EventHandler>();
    handlerMap.set("0xtest::events::FailMid", async (ctx) => {
      processedCount++;
      if (Number(ctx.eventSeq) === 2) {
        throw new Error("database connection lost");
      }
    });

    const events = Array.from({ length: 5 }, (_, i) =>
      makeMockEvent("0xtest::events::FailMid", `tx-fail`, String(i)),
    );

    const indexer = new Indexer({
      db: {} as any,
      eventSource: { poll: vi.fn() },
      handlerMap,
      cache: new CacheInvalidator(null),
      chainId: "test",
      pollIntervalMs: 100,
    });

    await expect(indexer.processBatch(events)).rejects.toThrow(
      "database connection lost",
    );
    // Should have processed events 0, 1, 2 (which threw)
    expect(processedCount).toBe(3);
  });

  it("handles events with very large eventSeq numbers", async () => {
    const seqs: bigint[] = [];
    const handlerMap = new Map<string, EventHandler>();
    handlerMap.set("0xtest::events::BigSeq", async (ctx) => {
      seqs.push(ctx.eventSeq);
    });

    const event = makeMockEvent(
      "0xtest::events::BigSeq",
      "tx-big",
      "9007199254740992", // > Number.MAX_SAFE_INTEGER
    );

    const indexer = new Indexer({
      db: {} as any,
      eventSource: { poll: vi.fn() },
      handlerMap,
      cache: new CacheInvalidator(null),
      chainId: "test",
      pollIntervalMs: 100,
    });

    await indexer.processBatch([event]);
    expect(seqs[0]).toBe(BigInt("9007199254740992"));
  });
});
