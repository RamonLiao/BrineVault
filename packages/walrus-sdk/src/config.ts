// ========== Walrus SDK Configuration ==========

/** Default Walrus endpoint configuration */
export interface WalrusConfig {
  /** Publisher URL for blob uploads and extensions */
  publisherUrl: string;
  /** Primary Aggregator URL for blob downloads */
  aggregatorUrl: string;
  /** Fallback Aggregator URLs (tried in order when primary fails) */
  fallbackAggregators?: string[];
  /** Default storage epochs when not specified */
  defaultEpochs?: number;
}

/** Chunking configuration */
export interface ChunkConfig {
  /** File size threshold for chunked upload (bytes). Default: 50 MB */
  chunkThreshold: number;
  /** Size of each chunk (bytes). Default: 10 MB */
  chunkSize: number;
  /** Max concurrent chunk uploads/downloads. Default: 3 */
  concurrency: number;
}

/** Retry configuration */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Base delay in ms */
  baseDelay: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** Backoff multiplier */
  backoffFactor: number;
}

// ---- Defaults ----

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkThreshold: 50 * 1024 * 1024, // 50 MB
  chunkSize: 10 * 1024 * 1024, // 10 MB
  concurrency: 3,
};

export const DEFAULT_UPLOAD_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1_000,
  maxDelay: 30_000,
  backoffFactor: 2,
};

export const DEFAULT_RENEWAL_RETRY: RetryConfig = {
  maxAttempts: 5,
  baseDelay: 1_000,
  maxDelay: 30_000,
  backoffFactor: 2,
};

export const WALRUS_PRESETS = {
  testnet: {
    publisherUrl: "https://publisher.testnet.walrus.atalabs.io",
    aggregatorUrl: "https://aggregator.testnet.walrus.atalabs.io",
    fallbackAggregators: [],
    defaultEpochs: 10,
  },
  mainnet: {
    publisherUrl: "https://publisher.walrus.atalabs.io",
    aggregatorUrl: "https://aggregator.walrus.atalabs.io",
    fallbackAggregators: ["https://aggregator-2.walrus.atalabs.io"],
    defaultEpochs: 10,
  },
} as const satisfies Record<string, WalrusConfig>;
