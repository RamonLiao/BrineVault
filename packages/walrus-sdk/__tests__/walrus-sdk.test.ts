import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WalrusClient,
  WalrusApiError,
  withRetry,
  type WalrusConfig,
  type ChunkManifest,
  type UploadProgress,
  type DownloadProgress,
} from "../src/index.js";

// ========== Helpers ==========

const KB = 1024;

/**
 * We use small sizes (KB-scale) for tests, with a custom chunkThreshold
 * and chunkSize to exercise the exact same code paths as 50MB/10MB in prod.
 *
 * Mapping:
 *   50MB threshold  → 5KB threshold in tests
 *   10MB chunk size → 1KB chunk size in tests
 *   60MB file       → 6KB file in tests
 */
const TEST_CHUNK_THRESHOLD = 5 * KB;
const TEST_CHUNK_SIZE = 1 * KB;

function randomBytes(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    buf[i] = i % 256;
  }
  return buf;
}

let blobCounter = 0;

/** Create a mock fetch that stores blobs in memory */
function createMockFetch(opts?: {
  failUploads?: number;
  failDownloads?: number;
  uploadStatus?: number;
  downloadStatus?: number;
}) {
  const store = new Map<string, Uint8Array>();
  let uploadAttempts = 0;
  let downloadAttempts = 0;

  const mockFetch = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const method = init?.method ?? "GET";

      // ---- Upload (POST /v1/blobs?epochs=N) ----
      if (
        method === "POST" &&
        url.includes("/v1/blobs") &&
        !url.includes("/extend")
      ) {
        uploadAttempts++;

        if (opts?.uploadStatus) {
          return new Response(`error ${opts.uploadStatus}`, {
            status: opts.uploadStatus,
          });
        }

        if (opts?.failUploads && uploadAttempts <= opts.failUploads) {
          return new Response("Service Unavailable", { status: 503 });
        }

        const body = init?.body;
        let bytes: Uint8Array;
        if (body instanceof Uint8Array) {
          bytes = new Uint8Array(body);
        } else if (body instanceof ArrayBuffer) {
          bytes = new Uint8Array(body);
        } else {
          bytes = new Uint8Array(0);
        }

        const blobId = `blob_${blobCounter++}`;
        store.set(blobId, bytes);

        return new Response(
          JSON.stringify({
            blobId,
            size: bytes.byteLength,
            createdEpoch: 42,
            expiryEpoch: 52,
            cost: { amount: "1000000", currency: "SUI" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // ---- Extend (POST /v1/blobs/:id/extend?epochs=N) ----
      if (method === "POST" && url.includes("/extend")) {
        const match = url.match(/\/v1\/blobs\/([^/]+)\/extend/);
        const blobId = match?.[1] ?? "";
        return new Response(
          JSON.stringify({
            blobId,
            newExpiryEpoch: 62,
            cost: { amount: "500000", currency: "SUI" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // ---- Download (GET /v1/blobs/:id) ----
      if (method === "GET" && url.includes("/v1/blobs/")) {
        downloadAttempts++;

        if (opts?.downloadStatus) {
          return new Response(`error ${opts.downloadStatus}`, {
            status: opts.downloadStatus,
          });
        }

        if (opts?.failDownloads && downloadAttempts <= opts.failDownloads) {
          return new Response("Service Unavailable", { status: 503 });
        }

        const blobId = url.split("/v1/blobs/")[1]?.split("?")[0] ?? "";
        const data = store.get(blobId);
        if (!data) {
          return new Response("Not Found", { status: 404 });
        }
        return new Response(data.buffer.slice(0), {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        });
      }

      return new Response("Not Found", { status: 404 });
    },
  );

  return { mockFetch, store };
}

const testConfig: WalrusConfig = {
  publisherUrl: "https://mock-publisher.test",
  aggregatorUrl: "https://mock-aggregator.test",
  fallbackAggregators: ["https://mock-aggregator-2.test"],
  defaultEpochs: 10,
};

const FAST_RETRY = {
  maxAttempts: 3,
  baseDelay: 1,
  maxDelay: 5,
  backoffFactor: 2,
};

function createClient(
  fetchFn: typeof globalThis.fetch,
  overrides?: { chunkThreshold?: number; chunkSize?: number },
) {
  return new WalrusClient({
    config: testConfig,
    fetchFn,
    uploadRetry: FAST_RETRY,
    renewalRetry: { ...FAST_RETRY, maxAttempts: 5 },
    chunkConfig: {
      chunkThreshold: overrides?.chunkThreshold ?? TEST_CHUNK_THRESHOLD,
      chunkSize: overrides?.chunkSize ?? TEST_CHUNK_SIZE,
      concurrency: 3,
    },
  });
}

// ========== Tests ==========

describe("WalrusClient", () => {
  beforeEach(() => {
    blobCounter = 0;
  });

  // ---- S3.1: Basic upload / download / extend ----

  describe("upload and download round-trip", () => {
    it("uploads and downloads 1KB file correctly", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(1024);
      const result = await client.upload(data, 10);

      expect(result.blobId).toBeTruthy();
      expect(result.manifest).toBeNull();
      expect(result.totalSize).toBe(1024);

      const downloaded = await client.download(result.blobId!);
      expect(downloaded).toEqual(data);
    });

    it("uploads and downloads 4KB file (under threshold) correctly", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(4 * KB);
      const result = await client.upload(data, 10);

      expect(result.blobId).toBeTruthy();
      expect(result.manifest).toBeNull();

      const downloaded = await client.download(result.blobId!);
      expect(downloaded).toEqual(data);
    });

    it("uses default epochs from config when not specified", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(100);
      await client.upload(data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("epochs=10"),
        expect.anything(),
      );
    });
  });

  describe("extend", () => {
    it("extends blob storage duration", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const result = await client.extend("blob_0", 10);
      expect(result.newExpiryEpoch).toBe(62);
      expect(result.cost.amount).toBe("500000");
    });
  });

  // ---- S3.2: Chunked upload (50MB boundary → 5KB boundary in tests) ----

  describe("chunked upload", () => {
    it("does NOT chunk a file exactly at threshold (5KB)", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(TEST_CHUNK_THRESHOLD); // exactly 5KB
      const result = await client.upload(data, 5);

      expect(result.blobId).toBeTruthy();
      expect(result.manifest).toBeNull();
    });

    it("chunks a file at threshold + 1 byte", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(TEST_CHUNK_THRESHOLD + 1); // 5KB + 1
      const result = await client.upload(data, 5);

      expect(result.blobId).toBeNull();
      expect(result.manifest).toBeTruthy();
      expect(result.manifest!.type).toBe("chunked");
      expect(result.manifest!.totalSize).toBe(TEST_CHUNK_THRESHOLD + 1);
      // (5*1024 + 1) / 1024 = 6 chunks (5 full + 1 partial with 1 byte)
      expect(result.manifest!.chunks.length).toBe(6);
    });

    it("chunks a 6KB file into correct manifest and reassembles (simulating 60MB)", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(6 * KB); // > 5KB threshold
      const result = await client.upload(data, 5);

      expect(result.manifest).toBeTruthy();
      const manifest = result.manifest!;
      expect(manifest.chunks.length).toBe(6); // 6KB / 1KB = 6

      // Each chunk should be 1KB
      for (const chunk of manifest.chunks) {
        expect(chunk.size).toBe(1 * KB);
      }

      // Download and verify round-trip
      const downloaded = await client.download(manifest);
      expect(downloaded.byteLength).toBe(6 * KB);
      expect(downloaded).toEqual(data);
    });

    it("tracks upload progress for chunked uploads", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const progressUpdates: UploadProgress[] = [];
      const data = randomBytes(TEST_CHUNK_THRESHOLD + 1); // 6 chunks
      await client.upload(data, 5, (p) => progressUpdates.push({ ...p }));

      expect(progressUpdates.length).toBeGreaterThan(0);

      const last = progressUpdates[progressUpdates.length - 1];
      expect(last.status).toBe("completed");
      expect(last.overallProgress).toBe(100);
      expect(last.completedChunks).toBe(last.totalChunks);
    });
  });

  // ---- S3.3: Chunked download ----

  describe("chunked download", () => {
    it("downloads and reassembles chunks in correct order", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(6 * KB);
      const uploadResult = await client.upload(data, 5);
      const manifest = uploadResult.manifest!;

      const progressUpdates: DownloadProgress[] = [];
      const downloaded = await client.download(manifest, (p) =>
        progressUpdates.push({ ...p }),
      );

      expect(downloaded).toEqual(data);

      const last = progressUpdates[progressUpdates.length - 1];
      expect(last.status).toBe("completed");
      expect(last.overallProgress).toBe(100);
    });
  });

  // ---- S3.4: Retry logic ----

  describe("retry logic", () => {
    it("retries on 503 and eventually succeeds", async () => {
      const { mockFetch } = createMockFetch({ failUploads: 2 });
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(1024);
      const result = await client.upload(data, 5);

      expect(result.blobId).toBeTruthy();
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("does NOT retry on 404", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      await expect(client.download("nonexistent_blob")).rejects.toThrow(
        WalrusApiError,
      );
    });

    it("switches to chunked on 413", async () => {
      const { mockFetch: baseMock } = createMockFetch();
      let firstCall = true;

      const smartFetch = vi.fn(
        async (input: string | URL | Request, init?: RequestInit) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url;
          const method = init?.method ?? "GET";

          // First upload call returns 413 to trigger chunking
          if (
            method === "POST" &&
            url.includes("/v1/blobs") &&
            !url.includes("/extend") &&
            firstCall
          ) {
            firstCall = false;
            return new Response("Payload Too Large", { status: 413 });
          }

          return baseMock(input, init);
        },
      );

      const client = new WalrusClient({
        config: testConfig,
        fetchFn: smartFetch as typeof globalThis.fetch,
        uploadRetry: FAST_RETRY,
        chunkConfig: {
          // Set threshold very high so the client tries single upload first
          chunkThreshold: 100 * KB,
          chunkSize: 512,
          concurrency: 3,
        },
      });

      const data = randomBytes(2048);
      const result = await client.upload(data, 5);

      expect(result.manifest).toBeTruthy();
      expect(result.manifest!.type).toBe("chunked");
    });

    it("throws after max retry attempts exhausted", async () => {
      const { mockFetch } = createMockFetch({ failUploads: 100 });
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(1024);
      await expect(client.upload(data, 5)).rejects.toThrow(WalrusApiError);
    });
  });

  // ---- S3.4: withRetry standalone ----

  describe("withRetry utility", () => {
    it("resolves immediately on success", async () => {
      const fn = vi.fn().mockResolvedValue("ok");
      const result = await withRetry(fn, {
        maxAttempts: 3,
        baseDelay: 1,
        maxDelay: 10,
        backoffFactor: 2,
      });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on generic errors and succeeds", async () => {
      let calls = 0;
      const fn = vi.fn(async () => {
        calls++;
        if (calls < 3) throw new Error("transient");
        return "ok";
      });
      const result = await withRetry(fn, {
        maxAttempts: 5,
        baseDelay: 1,
        maxDelay: 10,
        backoffFactor: 2,
      });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("does not retry non-retryable WalrusApiError (404)", async () => {
      const fn = vi.fn(async () => {
        throw new WalrusApiError("Not Found", 404);
      });
      await expect(
        withRetry(fn, {
          maxAttempts: 5,
          baseDelay: 1,
          maxDelay: 10,
          backoffFactor: 2,
        }),
      ).rejects.toThrow(WalrusApiError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry non-retryable WalrusApiError (400)", async () => {
      const fn = vi.fn(async () => {
        throw new WalrusApiError("Bad Request", 400);
      });
      await expect(
        withRetry(fn, {
          maxAttempts: 5,
          baseDelay: 1,
          maxDelay: 10,
          backoffFactor: 2,
        }),
      ).rejects.toThrow(WalrusApiError);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // ---- Fallback aggregator ----

  describe("fallback aggregator", () => {
    it("uses fallback when primary aggregator fails with 503", async () => {
      const store = new Map<string, Uint8Array>();
      const testData = randomBytes(256);
      store.set("test_blob", testData);

      let primaryCalls = 0;
      let fallbackCalls = 0;

      const smartFetch = vi.fn(
        async (input: string | URL | Request, init?: RequestInit) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url;
          const method = init?.method ?? "GET";

          // Upload
          if (method === "POST" && url.includes("/v1/blobs")) {
            const body = init?.body;
            const bytes =
              body instanceof Uint8Array ? body : new Uint8Array(0);
            const blobId = "test_blob";
            store.set(blobId, new Uint8Array(bytes));
            return new Response(
              JSON.stringify({
                blobId,
                size: bytes.byteLength,
                createdEpoch: 42,
                expiryEpoch: 52,
                cost: { amount: "1000000", currency: "SUI" },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          // Download from primary — always fail
          if (method === "GET" && url.includes("mock-aggregator.test")) {
            primaryCalls++;
            return new Response("Service Unavailable", { status: 503 });
          }

          // Download from fallback — succeed
          if (method === "GET" && url.includes("mock-aggregator-2.test")) {
            fallbackCalls++;
            const blobId =
              url.split("/v1/blobs/")[1]?.split("?")[0] ?? "";
            const data = store.get(blobId);
            if (!data) return new Response("Not Found", { status: 404 });
            return new Response(data.buffer.slice(0), {
              status: 200,
              headers: { "Content-Type": "application/octet-stream" },
            });
          }

          return new Response("Not Found", { status: 404 });
        },
      );

      const client = new WalrusClient({
        config: testConfig,
        fetchFn: smartFetch as typeof globalThis.fetch,
        uploadRetry: FAST_RETRY,
      });

      const downloaded = await client.downloadSingleBlob("test_blob");
      expect(downloaded).toEqual(testData);
      expect(primaryCalls).toBeGreaterThan(0);
      expect(fallbackCalls).toBeGreaterThan(0);
    });
  });

  // ---- S3.5: Progress callbacks ----

  describe("progress callbacks", () => {
    it("fires progress for single-blob upload", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const updates: UploadProgress[] = [];
      const data = randomBytes(1024);
      await client.upload(data, 5, (p) => updates.push({ ...p }));

      expect(updates.length).toBe(1);
      expect(updates[0].status).toBe("completed");
      expect(updates[0].overallProgress).toBe(100);
    });

    it("fires progress for single-blob download", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(1024);
      const result = await client.upload(data, 5);

      const updates: DownloadProgress[] = [];
      await client.download(result.blobId!, (p) => updates.push({ ...p }));

      expect(updates.length).toBe(1);
      expect(updates[0].status).toBe("completed");
    });

    it("fires incremental progress for chunked upload", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(
        mockFetch as typeof globalThis.fetch,
        { chunkThreshold: 1024, chunkSize: 256 },
      );

      const updates: UploadProgress[] = [];
      const data = randomBytes(1025); // > threshold, chunks into 5 chunks
      await client.upload(data, 5, (p) => updates.push({ ...p }));

      expect(updates.length).toBeGreaterThan(1);
      const last = updates[updates.length - 1];
      expect(last.status).toBe("completed");
      expect(last.overallProgress).toBe(100);

      // Progress should be monotonically increasing
      for (let i = 1; i < updates.length; i++) {
        expect(updates[i].completedChunks).toBeGreaterThanOrEqual(
          updates[i - 1].completedChunks,
        );
      }
    });

    it("fires incremental progress for chunked download", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(
        mockFetch as typeof globalThis.fetch,
        { chunkThreshold: 1024, chunkSize: 256 },
      );

      const data = randomBytes(1025);
      const uploadResult = await client.upload(data, 5);

      const updates: DownloadProgress[] = [];
      await client.download(uploadResult.manifest!, (p) =>
        updates.push({ ...p }),
      );

      expect(updates.length).toBeGreaterThan(1);
      const last = updates[updates.length - 1];
      expect(last.status).toBe("completed");
      expect(last.overallProgress).toBe(100);
    });
  });

  // ---- Monkey tests ----

  describe("monkey tests", () => {
    it("handles empty data upload", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = new Uint8Array(0);
      const result = await client.upload(data, 5);
      expect(result.blobId).toBeTruthy();

      const downloaded = await client.download(result.blobId!);
      expect(downloaded.byteLength).toBe(0);
    });

    it("handles 1 byte upload", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = new Uint8Array([42]);
      const result = await client.upload(data, 5);
      const downloaded = await client.download(result.blobId!);
      expect(downloaded).toEqual(data);
    });

    it("chunk size exactly matches data size (single chunk in chunked mode)", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(
        mockFetch as typeof globalThis.fetch,
        { chunkThreshold: 100, chunkSize: 200 },
      );

      // 200 bytes > 100 threshold but fits in 1 chunk
      const data = randomBytes(200);
      const result = await client.upload(data, 5);
      expect(result.manifest).toBeTruthy();
      expect(result.manifest!.chunks.length).toBe(1);

      const downloaded = await client.download(result.manifest!);
      expect(downloaded).toEqual(data);
    });

    it("handles concurrent uploads", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const uploads = Array.from({ length: 10 }, (_, i) =>
        client.upload(randomBytes(512 + i), 5),
      );

      const results = await Promise.all(uploads);
      expect(results.every((r) => r.blobId)).toBe(true);
      expect(new Set(results.map((r) => r.blobId)).size).toBe(10);
    });

    it("WalrusApiError properties are correct", () => {
      const err503 = new WalrusApiError("Service Unavailable", 503);
      expect(err503.retryable).toBe(true);
      expect(err503.shouldChunk).toBe(false);

      const err413 = new WalrusApiError("Payload Too Large", 413);
      expect(err413.retryable).toBe(false);
      expect(err413.shouldChunk).toBe(true);

      const err404 = new WalrusApiError("Not Found", 404);
      expect(err404.retryable).toBe(false);
      expect(err404.shouldChunk).toBe(false);

      const err500 = new WalrusApiError("Internal Error", 500);
      expect(err500.retryable).toBe(true);
      expect(err500.shouldChunk).toBe(false);
    });

    it("does not retry download on 404 even with fallback", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      await expect(client.download("nonexistent")).rejects.toThrow(
        WalrusApiError,
      );
    });

    it("handles download retry with 503 then success", async () => {
      const { mockFetch } = createMockFetch({ failDownloads: 1 });
      const client = createClient(mockFetch as typeof globalThis.fetch);

      const data = randomBytes(1024);
      const result = await client.upload(data, 5);

      const downloaded = await client.download(result.blobId!);
      expect(downloaded).toEqual(data);
    });

    it("extend with retry on 503", async () => {
      let attempts = 0;
      const smartFetch = vi.fn(
        async (input: string | URL | Request, _init?: RequestInit) => {
          const url =
            typeof input === "string"
              ? input
              : input instanceof URL
                ? input.toString()
                : input.url;
          if (url.includes("/extend")) {
            attempts++;
            if (attempts <= 2) {
              return new Response("Service Unavailable", { status: 503 });
            }
            return new Response(
              JSON.stringify({
                blobId: "blob_x",
                newExpiryEpoch: 62,
                cost: { amount: "500000", currency: "SUI" },
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }
          return new Response("Not Found", { status: 404 });
        },
      );

      const client = new WalrusClient({
        config: testConfig,
        fetchFn: smartFetch as typeof globalThis.fetch,
        renewalRetry: {
          maxAttempts: 5,
          baseDelay: 1,
          maxDelay: 5,
          backoffFactor: 2,
        },
      });

      const result = await client.extend("blob_x", 10);
      expect(result.newExpiryEpoch).toBe(62);
      expect(attempts).toBe(3);
    });

    it("chunk manifest with out-of-order indices reassembles correctly", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(mockFetch as typeof globalThis.fetch);

      // Upload 3 small blobs manually
      const chunk0 = randomBytes(100);
      const chunk1 = randomBytes(100);
      const chunk2 = randomBytes(50);

      const r0 = await client.uploadSingleBlob(chunk0, 5);
      const r1 = await client.uploadSingleBlob(chunk1, 5);
      const r2 = await client.uploadSingleBlob(chunk2, 5);

      // Create manifest with shuffled order
      const manifest: ChunkManifest = {
        type: "chunked",
        totalSize: 250,
        chunkSize: 100,
        chunks: [
          { index: 2, blobId: r2.blobId, size: 50 },
          { index: 0, blobId: r0.blobId, size: 100 },
          { index: 1, blobId: r1.blobId, size: 100 },
        ],
      };

      const downloaded = await client.download(manifest);
      expect(downloaded.byteLength).toBe(250);

      // Verify order
      const expected = new Uint8Array(250);
      expected.set(chunk0, 0);
      expected.set(chunk1, 100);
      expected.set(chunk2, 200);
      expect(downloaded).toEqual(expected);
    });

    it("data exactly at chunk size boundary (no partial last chunk)", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(
        mockFetch as typeof globalThis.fetch,
        { chunkThreshold: 100, chunkSize: 50 },
      );

      // 200 bytes = exactly 4 chunks of 50
      const data = randomBytes(200);
      const result = await client.upload(data, 5);
      expect(result.manifest).toBeTruthy();
      expect(result.manifest!.chunks.length).toBe(4);
      for (const chunk of result.manifest!.chunks) {
        expect(chunk.size).toBe(50);
      }

      const downloaded = await client.download(result.manifest!);
      expect(downloaded).toEqual(data);
    });

    it("handles large number of very small chunks", async () => {
      const { mockFetch } = createMockFetch();
      const client = createClient(
        mockFetch as typeof globalThis.fetch,
        { chunkThreshold: 10, chunkSize: 1 },
      );

      const data = randomBytes(50); // 50 chunks of 1 byte each
      const result = await client.upload(data, 5);
      expect(result.manifest).toBeTruthy();
      expect(result.manifest!.chunks.length).toBe(50);

      const downloaded = await client.download(result.manifest!);
      expect(downloaded).toEqual(data);
    });
  });
});
