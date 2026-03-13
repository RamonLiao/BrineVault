import type { Database } from "../client.js";

/**
 * Base repository with common DB reference.
 */
export abstract class BaseRepository {
  constructor(protected readonly db: Database) {}
}
