// ========== Chunked Downloader — parallel chunk download + reassembly ==========

import type { ChunkConfig } from "./config.js";
import type { ChunkManifest } from "./client.js";
import type { WalrusClient } from "./client.js";
import type { DownloadProgressCallback, DownloadProgress } from "./progress.js";

export class ChunkedDownloader {
  constructor(
    private readonly client: WalrusClient,
    private readonly cfg: ChunkConfig,
  ) {}

  /**
   * Download all chunks from a manifest, reassemble in order.
   */
  async download(
    manifest: ChunkManifest,
    onProgress?: DownloadProgressCallback,
  ): Promise<Uint8Array> {
    const totalChunks = manifest.chunks.length;

    const progress: DownloadProgress = {
      totalChunks,
      completedChunks: 0,
      overallProgress: 0,
      failedChunks: [],
      status: "downloading",
    };
    onProgress?.({ ...progress });

    // Sort by index to ensure correct order
    const sorted = [...manifest.chunks].sort((a, b) => a.index - b.index);

    const downloaded: Uint8Array[] = new Array(totalChunks);

    // Process in batches of `concurrency`
    for (let i = 0; i < totalChunks; i += this.cfg.concurrency) {
      const batch = sorted.slice(i, i + this.cfg.concurrency);
      const promises = batch.map(async (chunk) => {
        try {
          const data = await this.client.downloadSingleBlob(chunk.blobId);
          downloaded[chunk.index] = data;
          progress.completedChunks++;
          progress.overallProgress = Math.round(
            (progress.completedChunks / totalChunks) * 100,
          );
          onProgress?.({ ...progress });
        } catch (err) {
          progress.failedChunks.push(chunk.index);
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

    return this.reassemble(downloaded, manifest.totalSize);
  }

  /** Concatenate chunks into a single Uint8Array */
  private reassemble(chunks: Uint8Array[], totalSize: number): Uint8Array {
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }
}
