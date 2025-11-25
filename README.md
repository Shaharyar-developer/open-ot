# OpenOT

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**The Type-Agnostic Operational Transformation Framework.**

> **OpenOT is the OT engine that doesn’t assume your deployment.**
> Bring your own backend — Redis, Durable Objects, Dynamo, Postgres LISTEN/NOTIFY, or nothing at all.
> Bring your own network — WebSockets, SSE, Serverless POST batching, or even WebRTC.
> OpenOT’s state machine handles the hard part: consistency under chaos.

Whether you are syncing plain text, complex JSON trees, serialized rich-text (Lexical/ProseMirror), or a custom binary format—if you can define how to `transform` an operation, OpenOT handles the rest.

## Features

- **🎨 Data Agnostic:** Comes with a built-in **Text** type, but fully extensible for any data structure.
- **⚡️ Offline-First:** Works seamlessly offline. Operations are queued locally and synced automatically when the connection returns.
- **📦 Efficient Batching:** Small operations are coalesced client-side to reduce bandwidth and serverless invocation costs.
- **🔌 Storage Pluggable:** We provide reference adapters for **Redis** and **S3**, but the interface is simple: implement `.getSnapshot()` and `.appendOp()` to use any database.
- **🚀 Transport Optional:** Use our **WebSocket** or **HTTP-SSE** utilities, or build your own. It's just `.send()` and `.onReceive()`.

---

## Compatibility

Works seamlessly with:

- **React / Next.js**
- **Bun / Node.js**
- **Cloudflare Workers / Durable Objects**
- **Edge Runtimes**

---

## Installation

```bash
npm install @open-ot/core @open-ot/client @open-ot/server
```

Optional adapters:

```bash
npm install @open-ot/adapter-redis @open-ot/adapter-s3
npm install @open-ot/transport-websocket @open-ot/transport-http-sse
```

---

## Usage

### 1. Choose Your Type

OpenOT relies on an `OTType` definition. You can use the built-in types or define your own.

```typescript
import { TextType } from "@open-ot/core";

// Standard Retain/Insert/Delete logic for strings
const type = TextType;
```

### 2. Initialize the Server (Bring Your Own DB)

The server handles operation history, concurrency, and persistence. You can use our Redis adapter or implement your own `IBackendAdapter`.

```typescript
import { Server } from "@open-ot/server";
import { RedisAdapter } from "@open-ot/adapter-redis"; // Optional reference implementation
import { TextType } from "@open-ot/core";

// 1. Initialize Persistence (or use MemoryBackend, Postgres, etc.)
const backend = new RedisAdapter("redis://localhost:6379");

// 2. Initialize OpenOT Server
const server = new Server(backend);
server.registerType(TextType);

// 3. Submit an operation (usually called from your API/WebSocket handler)
// await server.submitOperation("doc-id", op, revision);
```

### 3. Initialize the Client (Bring Your Own Network)

The client manages local state, user input, and server synchronization.

```typescript
import { OTClient } from "@open-ot/client";
import { TextType } from "@open-ot/core";
import { WebSocketTransport } from "@open-ot/transport-websocket"; // Optional utility

// 1. Initialize Transport (or use your own socket/fetch logic)
const transport = new WebSocketTransport("ws://localhost:3000");

// 2. Create Client
const client = new OTClient({
  type: TextType,
  initialSnapshot: "Hello World",
  initialRevision: 0,
  transport: transport, // Optional: Client works without transport too!
});

// 3. Apply Local Change (User Types)
client.applyLocal([{ p: 5, i: " Alice" }]); // "Hello Alice World"

// Transport automatically handles sending to server and receiving updates!
```

### 4. Serverless Usage (Next.js)

For serverless environments, use the HTTP-SSE transport to avoid persistent connections and leverage batching.

```typescript
import { OTClient } from "@open-ot/client";
import { HttpSseTransport } from "@open-ot/transport-http-sse";

// Prefer WebSockets? Plug it in. On serverless? HTTP-SSE queues upstream ops.
const transport = new HttpSseTransport("https://api.myapp.com", {
  eventsPath: "/events", // SSE endpoint for downstream updates
  messagesPath: "/messages", // POST endpoint for upstream operations
});

const client = new OTClient({
  // ... options
  transport: transport,
});
```

---

## Packages

| Package                            | Description                                                |
| :--------------------------------- | :--------------------------------------------------------- |
| **`@open-ot/core`**                | Core interfaces and `TextType` implementation.             |
| **`@open-ot/client`**              | The generic Synchronization State Machine.                 |
| **`@open-ot/server`**              | Type-agnostic server for revision history and concurrency. |
| **`@open-ot/adapter-redis`**       | Reference adapter for Redis (Operations & Metadata).       |
| **`@open-ot/adapter-s3`**          | Reference adapter for AWS S3 (Snapshots).                  |
| **`@open-ot/transport-websocket`** | Utility adapter for WebSockets.                            |
| **`@open-ot/transport-http-sse`**  | Utility adapter for HTTP Server-Sent Events.               |

---

## License

MIT
