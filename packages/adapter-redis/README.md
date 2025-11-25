# @open-ot/adapter-redis

Redis backend adapter for OpenOT, providing persistent operation history and document metadata storage.

## Overview

`@open-ot/adapter-redis` implements the `IBackendAdapter` interface using Redis as the storage backend. It uses Redis lists for operation history and hashes for document metadata, with Lua scripts to ensure atomic commits.

## Installation

```bash
npm install @open-ot/adapter-redis @open-ot/server
```

## Quick Start

```typescript
import { Server } from '@open-ot/server';
import { RedisAdapter } from '@open-ot/adapter-redis';
import { TextType } from '@open-ot/core';

// 1. Create Redis adapter
const adapter = new RedisAdapter('redis://localhost:6379');

// 2. Initialize a document
await adapter.createDocument('doc-1', 'text', 'Hello World');

// 3. Create server
const server = new Server(adapter);
server.registerType(TextType);

// 4. Submit operations
const result = await server.submitOperation('doc-1', op, revision);
```

## Redis Data Structure

The adapter uses the following Redis keys:

### Document Metadata

**Key:** `doc:{docId}:metadata`  
**Type:** Hash  
**Fields:**
- `type`: The OT type name (e.g., `"text"`, `"json"`)
- `v`: Current revision number

**Example:**
```
HGETALL doc:my-document:metadata
1) "type"
2) "text"
3) "v"
4) "42"
```

### Document Snapshot

**Key:** `doc:{docId}:data`  
**Type:** String (JSON-encoded)  
**Value:** The current document snapshot

**Example:**
```
GET doc:my-document:data
"\"Hello World\""
```

### Operation History

**Key:** `doc:{docId}:history`  
**Type:** List  
**Value:** JSON-encoded operations in chronological order

**Example:**
```
LRANGE doc:my-document:history 0 -1
1) "[{\"i\":\"Hello\"}]"
2) "[{\"r\":5},{\"i\":\" World\"}]"
```

## API Reference

### `RedisAdapter`

#### Constructor

```typescript
new RedisAdapter(connectionString: string)
```

**Parameters:**
- **`connectionString`**: Redis connection URL (e.g., `redis://localhost:6379`)

**Example:**

```typescript
// Local Redis
const adapter = new RedisAdapter('redis://localhost:6379');

// Redis with authentication
const adapter = new RedisAdapter('redis://:password@localhost:6379');

// Redis Cloud / Upstash
const adapter = new RedisAdapter('rediss://default:password@host:port');
```

#### Methods

##### `getRecord(docId: string): Promise<DocumentRecord>`

Get the current document metadata and snapshot.

**Returns:**
```typescript
{
  type: string;    // OT type name
  v: number;       // Current revision
  data: unknown;   // Snapshot (parsed from JSON)
}
```

**Throws:**
- `Error` if the document doesn't exist.

##### `getHistory(docId: string, start: number, end?: number): Promise<unknown[]>`

Get a range of operations from the history.

**Parameters:**
- **`start`**: Starting revision (inclusive)
- **`end`**: Ending revision (exclusive, optional)

**Returns:**
- Array of operations (parsed from JSON)

**Example:**

```typescript
// Get operations from revision 5 to 10
const ops = await adapter.getHistory('doc-1', 5, 10);

// Get all operations from revision 5 onwards
const ops = await adapter.getHistory('doc-1', 5);
```

##### `saveOperation(docId: string, op: unknown, newRevision: number): Promise<void>`

Atomically append an operation to the history and increment the revision.

**Parameters:**
- **`docId`**: Document ID
- **`op`**: Operation to save
- **`newRevision`**: Expected new revision number

**Throws:**
- `Error` if the document doesn't exist.
- `Error` if there's a concurrency conflict (revision mismatch).

**Implementation:**

Uses a Lua script to ensure atomicity:

```lua
local currentV = redis.call("HGET", metaKey, "v")
if tonumber(currentV) ~= newRevision - 1 then
  return "ERR_CONCURRENCY"
end

redis.call("RPUSH", historyKey, op)
redis.call("HSET", metaKey, "v", newRevision)
```

##### `createDocument(docId: string, type: string, initialSnapshot: unknown): Promise<void>`

Initialize a new document.

**Parameters:**
- **`docId`**: Unique document identifier
- **`type`**: OT type name (e.g., `"text"`, `"json"`)
- **`initialSnapshot`**: Initial document state

**Example:**

```typescript
await adapter.createDocument('doc-1', 'text', 'Hello World');
await adapter.createDocument('doc-2', 'json', { users: [] });
```

##### `close(): Promise<void>`

Close the Redis connection.

**Example:**

```typescript
await adapter.close();
```

## Concurrency Control

The adapter uses **optimistic locking** to prevent race conditions:

1. Client submits operation with revision `n`
2. Server checks if current revision is `n`
3. If not, server transforms the operation against operations `n` to `current`
4. Lua script ensures atomic commit:
   - Check current revision is `newRevision - 1`
   - Append operation to history
   - Increment revision to `newRevision`

This guarantees **linearizability** even with concurrent clients.

## Production Deployment

### Redis Configuration

For production use, configure Redis for persistence:

**redis.conf:**
```
# AOF persistence for durability
appendonly yes
appendfsync everysec

# RDB snapshots as backup
save 900 1
save 300 10
save 60 10000
```

### Connection Pooling

The adapter uses `ioredis`, which handles connection pooling automatically. For high-traffic applications, consider:

```typescript
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
});

// Pass the Redis instance to the adapter
const adapter = new RedisAdapter(redis);
```

### Scaling

For horizontal scaling:

- **Redis Cluster**: Use Redis Cluster for sharding across multiple nodes.
- **Redis Sentinel**: Use Sentinel for high availability and automatic failover.
- **Upstash**: Use Upstash for serverless Redis with global replication.

**Example (Upstash):**

```typescript
const adapter = new RedisAdapter(process.env.UPSTASH_REDIS_URL!);
```

## Monitoring

Monitor key metrics:

- **Operation throughput**: `LLEN doc:{docId}:history`
- **Document count**: `KEYS doc:*:metadata | wc -l`
- **Memory usage**: `INFO memory`

## Cleanup

To delete a document and its history:

```bash
redis-cli DEL doc:my-document:metadata doc:my-document:data doc:my-document:history
```

Or programmatically:

```typescript
await redis.del(
  `doc:${docId}:metadata`,
  `doc:${docId}:data`,
  `doc:${docId}:history`
);
```

## Migration from MemoryBackend

```typescript
import { MemoryBackend } from '@open-ot/server';
import { RedisAdapter } from '@open-ot/adapter-redis';

// Before
const backend = new MemoryBackend();

// After
const backend = new RedisAdapter('redis://localhost:6379');
await backend.createDocument('doc-1', 'text', 'Initial content');
```

## License

MIT
