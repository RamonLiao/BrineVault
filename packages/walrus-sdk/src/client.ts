// ========== WalrusClient — Core upload / download / extend ==========

import {
  type WalrusConfig,
  type RetryConfig,
  type ChunkConfig,
  DEFAULT_UPLOAD_RETRY,
  DEFAULT_RENEWAL_RETRY,
  DEFAULT_CHUNK_CONFIG,
} from "./config.js";
import { withRetry, WalrusApiError } from "./retry.js";
import { ChunkedUploader } from "./chunked-upload.js";
import { ChunkedDownloader } from "./chunked-download.js";
import type {
  UploadProgressCallback,
  DownloadProgressCallback,
} from "./progress.js";

// ---- Response types ----

export interface WalrusUploadResult {
  blobId: string;
  size: number;
  createdEpoch: number;
  expiryEpoch: number;
  cost: { amount: string; currency: string };
}

export interface WalrusExtendResult {
  blobId: string;
  newExpiryEpoch: number;
  cost: { amount: string; currency: string };
}

export interface ChunkManifest {
  type: "chunked";
  totalSize: number;
  chunkSize: number;
  chunks: Array<{ index: number; blobId: string; size: number }>;
}

/** Result that covers both single-blob and chunked uploads */
export interface UploadResult {
  /** Non-null for single-blob uploads */
  blobId: string | null;
  /** Non-null for chunked uploads */
  manifest: ChunkManifest | null;
  totalSize: number;
}

// ---- Options ----

export interface WalrusClientOptions {
  config: WalrusConfig;
  chunkConfig?: Partial<ChunkConfig>;
  uploadRetry?: Partial<RetryConfig>;
  renewalRetry?: Partial<RetryConfig>;
  /** Custom fetch implementation (for testing or polyfills) */
  fetchFn?: typeof globalThis.fetch;
}

// ---- Client ----

export class WalrusClient {
  private readonly cfg: WalrusConfig;
  private readonly chunkCfg: ChunkConfig;
  private readonly uploadRetry: RetryConfig;
  private readonly renewalRetry: RetryConfig;
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(opts: WalrusClientOptions) {
    this.cfg = opts.config;
    this.chunkCfg = { ...DEFAULT_CHUNK_CONFIG, ...opts.chunkConfig };
    this.uploadRetry = { ...DEFAULT_UPLOAD_RETRY, ...opts.uploadRetry };
    this.renewalRetry = { ...DEFAULT_RENEWAL_RETRY, ...opts.renewalRetry };
    this.fetchFn = opts.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  // ---- Upload (auto-chunked) ----

  /**
   * Upload data to Walrus.
   * Automatically switches to chunked upload when data > chunkThreshold.
   */
  async upload(
    data: Uint8Array,
    epochs?: number,
    onProgress?: UploadProgressCallback,
  ): Promise<UploadResult> {
    const ep = epochs ?? this.cfg.defaultEpochs ?? 10;

    if (data.byteLength > this.chunkCfg.chunkThreshold) {
      const uploader = new ChunkedUploader(this, this.chunkCfg);
      const manifest = await uploader.upload(data, ep, onProgress);
      return { blobId: null, manifest, totalSize: data.byteLength };
    }

    // Single-blob upload
    try {
      const result = await this.uploadSingleBlob(data, ep);
      onProgress?.({
        totalChunks: 1,
        completedChunks: 1,
        overallProgress: 100,
        failedChunks: [],
        status: "completed",
      });
      return { blobId: result.blobId, manifest: null, totalSize: data.byteLength };
    } catch (err) {
      // 413 → switch to chunked
      if (err instanceof WalrusApiError && err.shouldChunk) {
        const uploader = new ChunkedUploader(this, this.chunkCfg);
        const manifest = await uploader.upload(data, ep, onProgress);
        return { blobId: null, manifest, totalSize: data.byteLength };
      }
      throw err;
    }
  }

  // ---- Download (auto-chunked) ----

  /**
   * Download a blob or a chunked manifest from Walrus.
   * If `manifest` is provided, performs chunked download & reassembly.
   */
  async download(
    blobIdOrManifest: string | ChunkManifest,
    onProgress?: DownloadProgressCallback,
  ): Promise<Uint8Array> {
    if (typeof blobIdOrManifest === "string") {
      const data = await this.downloadSingleBlob(blobIdOrManifest);
      onProgress?.({
        totalChunks: 1,
        completedChunks: 1,
        overallProgress: 100,
        failedChunks: [],
        status: "completed",
      });
      return data;
    }

    // Chunked download
    const downloader = new ChunkedDownloader(this, this.chunkCfg);
    return downloader.download(blobIdOrManifest, onProgress);
  }

  // ---- Extend ----

  /**
   * Extend storage duration for a blob.
   */
  async extend(
    blobId: string,
    additionalEpochs: number,
  ): Promise<WalrusExtendResult> {
    return withRetry(async () => {
      const url = `${this.cfg.publisherUrl}/v1/blobs/${encodeURIComponent(blobId)}/extend?epochs=${additionalEpochs}`;
      const res = await this.fetchFn(url, { method: "POST" });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new WalrusApiError(
          `Walrus extend failed (${res.status})`,
          res.status,
          body,
        );
      }
      return (await res.json()) as WalrusExtendResult;
    }, this.renewalRetry);
  }

  // ---- Low-level (also used by ChunkedUploader / ChunkedDownloader) ----

  /** Upload a single blob to the Publisher with retry */
  async uploadSingleBlob(
    data: Uint8Array,
    epochs: number,
  ): Promise<WalrusUploadResult> {
    return withRetry(async () => {
      const url = `${this.cfg.publisherUrl}/v1/blobs?epochs=${epochs}`;
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: data as unknown as BodyInit,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new WalrusApiError(
          `Walrus upload failed (${res.status})`,
          res.status,
          body,
        );
      }
      return (await res.json()) as WalrusUploadResult;
    }, this.uploadRetry);
  }

  /** Download a single blob from the Aggregator with fallback */
  async downloadSingleBlob(blobId: string): Promise<Uint8Array> {
    const urls = [
      `${this.cfg.aggregatorUrl}/v1/blobs/${encodeURIComponent(blobId)}`,
      ...(this.cfg.fallbackAggregators ?? []).map(
        (u) => `${u}/v1/blobs/${encodeURIComponent(blobId)}`,
      ),
    ];

    let lastError: unknown;
    for (const url of urls) {
      try {
        return await withRetry(async () => {
          const res = await this.fetchFn(url, { method: "GET" });
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new WalrusApiError(
              `Walrus download failed (${res.status})`,
              res.status,
              body,
            );
          }
          const ab = await res.arrayBuffer();
          return new Uint8Array(ab);
        }, this.uploadRetry);
      } catch (err) {
        lastError = err;
        // 404 = blob not found, don't try fallbacks
        if (err instanceof WalrusApiError && err.status === 404) {
          throw err;
        }
        // Try next aggregator
      }
    }

    throw lastError;
  }
}
