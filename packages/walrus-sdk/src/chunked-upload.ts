// ========== Chunked Uploader — splits >50MB files into 10MB chunks ==========

import type { ChunkConfig } from "./config.js";
import type { ChunkManifest } from "./client.js";
import type { WalrusClient } from "./client.js";
import type { UploadProgressCallback, UploadProgress } from "./progress.js";

export class ChunkedUploader {
  constructor(
    private readonly client: WalrusClient,
    private readonly cfg: ChunkConfig,
  ) {}

  /**
   * Split data into chunks, upload in parallel (limited concurrency),
   * and return a ChunkManifest.
   */
  async upload(
    data: Uint8Array,
    epochs: number,
    onProgress?: UploadProgressCallback,
  ): Promise<ChunkManifest> {
    const chunks = this.split(data);
    const totalChunks = chunks.length;

    const progress: UploadProgress = {
      totalChunks,
      completedChunks: 0,
      overallProgress: 0,
      failedChunks: [],
      status: "uploading",
    };
    onProgress?.({ ...progress });

    const results: Array<{ index: number; blobId: string; size: number }> =
      new Array(totalChunks);

    // Process in batches of `concurrency`
    for (let i = 0; i < totalChunks; i += this.cfg.concurrency) {
      const batch = chunks.slice(i, i + this.cfg.concurrency);
      const promises = batch.map(async (chunk, batchIdx) => {
        const chunkIndex = i + batchIdx;
        try {
          const result = await this.client.uploadSingleBlob(chunk, epochs);
          results[chunkIndex] = {
            index: chunkIndex,
            blobId: result.blobId,
            size: chunk.byteLength,
          };
          progress.completedChunks++;
          progress.overallProgress = Math.round(
            (progress.completedChunks / totalChunks) * 100,
          );
          onProgress?.({ ...progress });
        } catch (err) {
          progress.failedChunks.push(chunkIndex);
          progress.status = "failed";
          onProgress?.({ ...progress });
          throw err;
        }
      });

      await Promise.all(promises);
    }

    progress.status = "completed";
    progress.overallProgress = 100;
    onProgress?.({ ...progress });

    return {
      type: "chunked",
      totalSize: data.byteLength,
      chunkSize: this.cfg.chunkSize,
      chunks: results,
    };
  }

  /** Split Uint8Array into chunks of chunkSize */
  private split(data: Uint8Array): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < data.byteLength; offset += this.cfg.chunkSize) {
      const end = Math.min(offset + this.cfg.chunkSize, data.byteLength);
      chunks.push(data.subarray(offset, end));
    }
    return chunks;
  }
}
