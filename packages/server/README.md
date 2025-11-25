# @open-ot/server

The server-side coordinator for OpenOT, handling operation history, concurrency control, and transformation.

## Overview

`@open-ot/server` is a lightweight, database-agnostic server that manages the canonical operation history. It doesn't care about your database—just implement the `IBackendAdapter` interface to use Redis, Postgres, MongoDB, or any other storage solution.

## Installation

```bash
npm install @open-ot/server @open-ot/core
```

## Quick Start

```typescript
import { Server } from '@open-ot/server';
import { MemoryBackend } from '@open-ot/server';
import { TextType } from '@open-ot/core';

// 1. Create a backend adapter
const backend = new MemoryBackend();
await backend.createDocument('doc-1', 'text', 'Hello World');

// 2. Initialize the server
const server = new Server(backend);
server.registerType(TextType);

// 3. Submit an operation
const result = await server.submitOperation(
  'doc-1',
  [{ r: 5 }, { i: ' Alice' }, { r: 6 }],
  0 // Client's current revision
);

console.log(result);
// => { op: [...], revision: 1 }
```

## How It Works

### The "Catch Up" Phase

When a client submits an operation, the server:

1. **Checks the client's revision**: Is the client up-to-date?
2. **Transforms if needed**: If the client is behind, the server transforms the client's operation against all operations that happened since the client's revision.
3. **Appends to history**: The transformed operation is added to the canonical history.
4. **Returns the result**: The server sends back the transformed operation and the new revision.

**Example:**

```
Client A (revision 0): [{ i: "A" }]
Client B (revision 0): [{ i: "B" }]

Server receives A's operation first:
  - Appends to history: [{ i: "A" }]
  - Revision: 1

Server receives B's operation (still at revision 0):
  - Transforms B's op against A's op: [{ r: 1 }, { i: "B" }]
  - Appends to history: [{ r: 1 }, { i: "B" }]
  - Revision: 2

Final document: "AB"
```

### Concurrency Control

The server uses **optimistic locking** to prevent conflicts:

- Each operation is tagged with the client's current revision.
- If the revision doesn't match, the operation is transformed against the missing history.
- The backend adapter ensures atomic commits (operation append + revision increment).

## API Reference

### `Server`

#### Constructor

```typescript
new Server(backend: IBackendAdapter)
```

**Parameters:**
- **`backend`**: An implementation of `IBackendAdapter` (e.g., `MemoryBackend`, `RedisAdapter`).

#### Methods

##### `registerType<Snapshot, Op>(type: OTType<Snapshot, Op>): void`

Register an OT type with the server.

**Example:**

```typescript
import { TextType, JsonType } from '@open-ot/core';

server.registerType(TextType);
server.registerType(JsonType);
```

##### `submitOperation(docId: string, op: unknown, revision: number): Promise<{ op: unknown; revision: number }>`

Handle an operation submitted by a client.

**Parameters:**
- **`docId`**: The document ID.
- **`op`**: The operation to apply.
- **`revision`**: The revision the client thinks they are building on.

**Returns:**
- **`op`**: The transformed operation (if the client was behind).
- **`revision`**: The new revision number.

**Throws:**
- `Error` if the document type is not registered.
- `Error` if the revision is invalid.

**Example:**

```typescript
try {
  const result = await server.submitOperation('doc-1', op, clientRevision);
  // Broadcast result.op to all other clients
} catch (error) {
  console.error('Operation failed:', error);
}
```

## Backend Adapters

The server requires a backend adapter to persist operation history. You can use the built-in `MemoryBackend` for testing or implement your own.

### `IBackendAdapter`

```typescript
interface IBackendAdapter {
  getRecord(docId: string): Promise<DocumentRecord>;
  getHistory(docId: string, start: number, end?: number): Promise<unknown[]>;
  saveOperation(docId: string, op: unknown, newRevision: number): Promise<void>;
}
```

#### `DocumentRecord`

```typescript
interface DocumentRecord {
  type: string;        // e.g., "text", "json"
  v: number;           // Current revision
  data: unknown;       // The snapshot (optional, used for initialization)
}
```

### Built-in: `MemoryBackend`

An in-memory adapter for testing and development.

**Example:**

```typescript
import { MemoryBackend } from '@open-ot/server';

const backend = new MemoryBackend();
await backend.createDocument('doc-1', 'text', 'Initial content');
```

**Methods:**
- `createDocument(docId, type, initialSnapshot)` — Initialize a new document.
- `getRecord(docId)` — Get the document metadata.
- `getHistory(docId, start, end?)` — Get operation history.
- `saveOperation(docId, op, newRevision)` — Append an operation.

### Using Redis

For production, use the `@open-ot/adapter-redis` package:

```bash
npm install @open-ot/adapter-redis
```

```typescript
import { RedisAdapter } from '@open-ot/adapter-redis';

const backend = new RedisAdapter('redis://localhost:6379');
await backend.createDocument('doc-1', 'text', 'Hello World');

const server = new Server(backend);
```

See the [`@open-ot/adapter-redis` README](../adapter-redis/README.md) for details.

## Implementing a Custom Adapter

To use your own database, implement the `IBackendAdapter` interface:

```typescript
import { IBackendAdapter, DocumentRecord } from '@open-ot/server';

class PostgresAdapter implements IBackendAdapter {
  async getRecord(docId: string): Promise<DocumentRecord> {
    // Fetch from Postgres
    const row = await db.query('SELECT * FROM documents WHERE id = $1', [docId]);
    return {
      type: row.type,
      v: row.revision,
      data: row.snapshot,
    };
  }

  async getHistory(docId: string, start: number, end?: number): Promise<unknown[]> {
    // Fetch operations from Postgres
    const rows = await db.query(
      'SELECT op FROM operations WHERE doc_id = $1 AND revision >= $2 AND revision < $3',
      [docId, start, end ?? Number.MAX_SAFE_INTEGER]
    );
    return rows.map(r => r.op);
  }

  async saveOperation(docId: string, op: unknown, newRevision: number): Promise<void> {
    // Atomic commit with transaction
    await db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO operations (doc_id, revision, op) VALUES ($1, $2, $3)',
        [docId, newRevision, op]
      );
      await tx.query(
        'UPDATE documents SET revision = $1 WHERE id = $2',
        [newRevision, docId]
      );
    });
  }
}
```

## Integration with WebSockets

Typical server setup with WebSockets:

```typescript
import { Server } from '@open-ot/server';
import { RedisAdapter } from '@open-ot/adapter-redis';
import { TextType } from '@open-ot/core';
import { WebSocketServer } from 'ws';

const backend = new RedisAdapter('redis://localhost:6379');
const otServer = new Server(backend);
otServer.registerType(TextType);

const wss = new WebSocketServer({ port: 3000 });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === 'op') {
      try {
        const result = await otServer.submitOperation(
          msg.docId,
          msg.op,
          msg.revision
        );
        
        // Send ACK to sender
        ws.send(JSON.stringify({ type: 'ack' }));
        
        // Broadcast to all other clients
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
              type: 'op',
              op: result.op,
              revision: result.revision,
            }));
          }
        });
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', message: error.message }));
      }
    }
  });
});
```

## Serverless Deployment

The server is stateless and works great in serverless environments:

- **Cloudflare Workers + Durable Objects**: Use Durable Objects for coordination.
- **AWS Lambda + DynamoDB**: Use DynamoDB for operation history.
- **Vercel Edge Functions + Upstash Redis**: Use Upstash for persistence.

**Example (Next.js API Route):**

```typescript
// app/api/ot/route.ts
import { Server } from '@open-ot/server';
import { RedisAdapter } from '@open-ot/adapter-redis';
import { TextType } from '@open-ot/core';

const backend = new RedisAdapter(process.env.REDIS_URL!);
const server = new Server(backend);
server.registerType(TextType);

export async function POST(req: Request) {
  const { docId, op, revision } = await req.json();
  
  const result = await server.submitOperation(docId, op, revision);
  
  return Response.json(result);
}
```

## License

MIT
