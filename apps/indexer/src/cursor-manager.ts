import type { EventId } from "@mysten/sui/client";
import { IndexerCheckpointsRepository, type Database } from "@rwa-dataroom/db";

/**
 * Manages cursor-based checkpointing for event indexing.
 * Persists the last processed event cursor to the database so
 * the indexer can resume from the correct position after restart.
 */
export class CursorManager {
  private repo: IndexerCheckpointsRepository;
  private checkpointId: number;
  private chainId: string;

  constructor(db: Database, chainId: string, checkpointId = 1) {
    this.repo = new IndexerCheckpointsRepository(db);
    this.chainId = chainId;
    this.checkpointId = checkpointId;
  }

  /**
   * Load the last saved cursor from the database.
   * Returns null if no checkpoint exists (start from beginning).
   */
  async loadCursor(): Promise<EventId | null> {
    const checkpoint = await this.repo.getCheckpoint(this.checkpointId);
    if (!checkpoint?.lastCursor) return null;

    // EventId is { txDigest: string; eventSeq: string }
    try {
      return JSON.parse(checkpoint.lastCursor) as EventId;
    } catch {
      return null;
    }
  }

  /**
   * Save the current cursor after successfully processing a batch.
   */
  async saveCursor(cursor: EventId, txDigest: string, eventSeq: bigint): Promise<void> {
    await this.repo.upsertCheckpoint({
      id: this.checkpointId,
      chainId: this.chainId,
      lastCursor: JSON.stringify(cursor),
      lastTxDigest: txDigest,
      lastEventSeq: eventSeq,
    });
  }

  /**
   * Get last event sequence for health checks.
   */
  async getLastEventSeq(): Promise<bigint> {
    const checkpoint = await this.repo.getCheckpoint(this.checkpointId);
    return checkpoint?.lastEventSeq ?? BigInt(0);
  }
}
