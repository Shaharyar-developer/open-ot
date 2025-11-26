import Redis from "ioredis";
import { IBackendAdapter, DocumentRecord } from "@open-ot/server";

export class RedisAdapter implements IBackendAdapter {
  private redis: Redis;
  private subRedis: Redis | null = null;
  private connectionString: string;
  private subscriptions: Map<string, Set<(msg: string) => void>> = new Map();

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.redis = new Redis(connectionString);
  }

  /**
   * Get the current global revision and type of the document
   * Keys:
   * - doc:{docId}:metadata -> { type, v }
   * - doc:{docId}:data -> snapshot (stringified)
   */
  async getRecord(docId: string): Promise<DocumentRecord> {
    const pipeline = this.redis.pipeline();
    pipeline.hgetall(`doc:${docId}:metadata`);
    pipeline.get(`doc:${docId}:data`);

    const results = await pipeline.exec();
    if (!results) throw new Error("Redis pipeline failed");

    const [metadataErr, metadata] = results[0]!;
    const [dataErr, dataStr] = results[1]!;

    if (metadataErr) throw metadataErr;
    if (dataErr) throw dataErr;

    const meta = metadata as Record<string, string>;

    if (!meta || !meta.type) {
      throw new Error(`Document ${docId} not found`);
    }

    return {
      type: meta.type,
      v: parseInt(meta.v ?? "0", 10),
      data: dataStr ? JSON.parse(dataStr as string) : null,
    };
  }

  /**
   * Get a range of past operations for transformation
   * Key:
   * - doc:{docId}:history -> List of operations
   */
  async getHistory(
    docId: string,
    start: number,
    end?: number
  ): Promise<unknown[]> {
    // Redis LRANGE is inclusive for both start and stop.
    // Our 'end' is exclusive (like slice).
    // If end is undefined, we want to the end of the list (-1).

    const stop = end === undefined ? -1 : end - 1;

    // Revision numbers map directly to list indices (e.g. v0 -> v1 is op at index 0).

    const opsStr = await this.redis.lrange(`doc:${docId}:history`, start, stop);

    return opsStr.map((op) => JSON.parse(op));
  }

  /**
   * Atomic commit: Add op to history AND increment revision
   * We use a Lua script or MULTI/EXEC to ensure atomicity.
   */
  async saveOperation(
    docId: string,
    op: unknown,
    newRevision: number
  ): Promise<void> {
    // We need to check if the current revision matches newRevision - 1.
    // Optimistic locking with WATCH or just a Lua script.
    // Lua script is safer and faster.

    // Script logic:
    // 1. Get current v from metadata.
    // 2. If current v != newRevision - 1, return error.
    // 3. RPUSH op to history.
    // 4. HSET v = newRevision in metadata.
    // 5. Return success.

    const script = `
      local docId = KEYS[1]
      local newRevision = tonumber(ARGV[1])
      local op = ARGV[2]
      
      local metaKey = "doc:" .. docId .. ":metadata"
      local historyKey = "doc:" .. docId .. ":history"
      
      local currentV = redis.call("HGET", metaKey, "v")
      if not currentV then
        return "ERR_NOT_FOUND"
      end
      
      if tonumber(currentV) ~= newRevision - 1 then
        return "ERR_CONCURRENCY"
      end
      
      redis.call("RPUSH", historyKey, op)
      redis.call("HSET", metaKey, "v", newRevision)
      
      return "OK"
    `;

    const result = await this.redis.eval(
      script,
      1,
      docId,
      newRevision,
      JSON.stringify(op)
    );

    if (result === "ERR_NOT_FOUND") {
      throw new Error(`Document ${docId} not found`);
    }

    if (result === "ERR_CONCURRENCY") {
      throw new Error(
        `Concurrency error: Expected revision ${newRevision - 1}`
      );
    }
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: string): Promise<void> {
    await this.redis.publish(channel, message);
  }

  /**
   * Subscribe to a channel
   * Returns an unsubscribe function
   */
  async subscribe(
    channel: string,
    onMessage: (msg: string) => void
  ): Promise<() => void> {
    if (!this.subRedis) {
      this.subRedis = new Redis(this.connectionString);

      this.subRedis.on("message", (chan, msg) => {
        const callbacks = this.subscriptions.get(chan);
        if (callbacks) {
          callbacks.forEach((cb) => cb(msg));
        }
      });
    }

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subRedis.subscribe(channel);
    }

    this.subscriptions.get(channel)!.add(onMessage);

    return async () => {
      const callbacks = this.subscriptions.get(channel);
      if (callbacks) {
        callbacks.delete(onMessage);
        if (callbacks.size === 0) {
          this.subscriptions.delete(channel);
          if (this.subRedis) {
            await this.subRedis.unsubscribe(channel);
          }
        }
      }
    };
  }

  /**
   * Helper to create a document (for testing/initialization)
   */
  async createDocument(
    docId: string,
    type: string,
    initialSnapshot: unknown
  ): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.hset(`doc:${docId}:metadata`, { type, v: 0 });
    pipeline.set(`doc:${docId}:data`, JSON.stringify(initialSnapshot));
    pipeline.del(`doc:${docId}:history`); // Clear history if recreating
    await pipeline.exec();
  }

  async close() {
    await this.redis.quit();
    if (this.subRedis) {
      await this.subRedis.quit();
    }
  }
}
