import { SuiClient, type SuiEvent, type EventId } from "@mysten/sui/client";
import type { IndexerConfig } from "./config.js";

export interface SuiEventSubscription {
  poll(cursor: EventId | null): Promise<{
    events: SuiEvent[];
    nextCursor: EventId | null;
    hasNextPage: boolean;
  }>;
}

/**
 * Wrapper around Sui JSON-RPC client for event polling.
 */
export class SuiEventPoller implements SuiEventSubscription {
  private client: SuiClient;
  private packageId: string;

  constructor(config: IndexerConfig) {
    this.client = new SuiClient({ url: config.suiRpcUrl });
    this.packageId = config.packageId;
  }

  async poll(cursor: EventId | null) {
    const result = await this.client.queryEvents({
      query: { MoveModule: { package: this.packageId, module: "events" } },
      cursor: cursor ?? undefined,
      limit: 50,
      order: "ascending",
    });
    return {
      events: result.data,
      nextCursor: result.nextCursor ?? null,
      hasNextPage: result.hasNextPage,
    };
  }
}
