import { describe, it, expect, vi, beforeEach } from "vitest";
import { CursorManager } from "../src/cursor-manager.js";
import type { Database } from "@rwa-dataroom/db";

describe("CursorManager", () => {
  // Since CursorManager depends on IndexerCheckpointsRepository which needs a real DB,
  // we test the logic around parsing/formatting cursors.

  it("can be instantiated with a db reference", () => {
    const mockDb = {} as Database;
    const cm = new CursorManager(mockDb, "sui:testnet");
    expect(cm).toBeDefined();
  });

  it("loadCursor returns null when no checkpoint exists", async () => {
    // Mock the repository to return null
    const mockDb = {} as Database;
    const cm = new CursorManager(mockDb, "sui:testnet");

    // Override the internal repo for testing
    const repo = (cm as any).repo;
    repo.getCheckpoint = vi.fn().mockResolvedValue(null);

    const cursor = await cm.loadCursor();
    expect(cursor).toBeNull();
  });

  it("loadCursor parses stored JSON cursor", async () => {
    const mockDb = {} as Database;
    const cm = new CursorManager(mockDb, "sui:testnet");

    const repo = (cm as any).repo;
    repo.getCheckpoint = vi.fn().mockResolvedValue({
      id: 1,
      chainId: "sui:testnet",
      lastCursor: JSON.stringify({ txDigest: "abc123", eventSeq: "42" }),
      lastTxDigest: "abc123",
      lastEventSeq: BigInt(42),
      updatedAt: new Date(),
    });

    const cursor = await cm.loadCursor();
    expect(cursor).toEqual({ txDigest: "abc123", eventSeq: "42" });
  });

  it("loadCursor returns null for malformed cursor JSON", async () => {
    const mockDb = {} as Database;
    const cm = new CursorManager(mockDb, "sui:testnet");

    const repo = (cm as any).repo;
    repo.getCheckpoint = vi.fn().mockResolvedValue({
      id: 1,
      chainId: "sui:testnet",
      lastCursor: "not-valid-json{{{",
      lastTxDigest: null,
      lastEventSeq: BigInt(0),
      updatedAt: new Date(),
    });

    const cursor = await cm.loadCursor();
    expect(cursor).toBeNull();
  });

  it("saveCursor calls upsertCheckpoint with correct data", async () => {
    const mockDb = {} as Database;
    const cm = new CursorManager(mockDb, "sui:testnet");

    const upsertMock = vi.fn().mockResolvedValue([{}]);
    const repo = (cm as any).repo;
    repo.upsertCheckpoint = upsertMock;

    await cm.saveCursor(
      { txDigest: "tx99", eventSeq: "100" },
      "tx99",
      BigInt(100),
    );

    expect(upsertMock).toHaveBeenCalledWith({
      id: 1,
      chainId: "sui:testnet",
      lastCursor: JSON.stringify({ txDigest: "tx99", eventSeq: "100" }),
      lastTxDigest: "tx99",
      lastEventSeq: BigInt(100),
    });
  });

  it("getLastEventSeq returns 0n when no checkpoint", async () => {
    const mockDb = {} as Database;
    const cm = new CursorManager(mockDb, "sui:testnet");

    const repo = (cm as any).repo;
    repo.getCheckpoint = vi.fn().mockResolvedValue(null);

    const seq = await cm.getLastEventSeq();
    expect(seq).toBe(BigInt(0));
  });

  it("getLastEventSeq returns stored value", async () => {
    const mockDb = {} as Database;
    const cm = new CursorManager(mockDb, "sui:testnet");

    const repo = (cm as any).repo;
    repo.getCheckpoint = vi.fn().mockResolvedValue({
      lastEventSeq: BigInt(999),
    });

    const seq = await cm.getLastEventSeq();
    expect(seq).toBe(BigInt(999));
  });
});
