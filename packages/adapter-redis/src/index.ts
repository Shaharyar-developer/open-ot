import Redis from "ioredis";
import { IBackendAdapter, DocumentRecord } from "@open-ot/server";

export class RedisAdapter implements IBackendAdapter {
  private redis: Redis;

  constructor(connectionString: string) {
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
      // Document doesn't exist, return default or throw?
      // For now, let's assume it must exist or we throw.
      // Or maybe we return a "not found" error that the server handles?
      // The MemoryBackend threw "Document not found".
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

    // Note: Redis list indices are 0-based.
    // 'start' is the revision number?
    // Wait, revision 0 produces op 0?
    // If history is [op0, op1, op2], then op0 takes us from v0 to v1?
    // Or is v0 the initial state?
    // Usually:
    // v0 (empty) + op0 -> v1.
    // So op0 is stored at index 0.
    // If client is at v0, they need ops starting from index 0.
    // So 'start' matches the list index.

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
  }
}
