# @open-ot/transport-websocket

WebSocket transport adapter for OpenOT. Provides low-latency, bidirectional real-time communication for collaborative applications.

## Installation

```bash
npm install @open-ot/transport-websocket ws
```

## Overview

This package provides a `TransportAdapter` implementation using WebSockets for both sending and receiving operations. It's ideal for:
- Traditional server environments (Node.js, VPS, Docker)
- Applications requiring the lowest possible latency
- Environments where long-lived connections are supported

## Usage

### Client-Side

```typescript
import { WebSocketTransport } from "@open-ot/transport-websocket";
import { OTClient } from "@open-ot/client";
import { TextType } from "@open-ot/core";

const transport = new WebSocketTransport("ws://localhost:3000");

const client = new OTClient({
  type: TextType,
  initialSnapshot: "",
  initialRevision: 0,
  transport: transport,
});

// The client automatically connects and syncs
```

### Server-Side (Node.js)

```typescript
import { WebSocketServer } from "ws";
import { Server, MemoryBackend } from "@open-ot/server";
import { TextType } from "@open-ot/core";

const backend = new MemoryBackend();
const otServer = new Server(backend);
otServer.registerType(TextType);

await backend.createDocument("doc-1", "text", "");

const wss = new WebSocketServer({ port: 3000 });

wss.on("connection", (ws) => {
  ws.on("message", async (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === "op") {
      const result = await otServer.submitOperation(
        "doc-1",
        msg.op,
        msg.revision
      );

      // Acknowledge sender
      ws.send(JSON.stringify({ type: "ack" }));

      // Broadcast to others
      const update = JSON.stringify({
        type: "op",
        op: result.op,
        revision: result.revision,
      });

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(update);
        }
      });
    }
  });
});
```

## API Reference

### `WebSocketTransport`

#### Constructor

```typescript
new WebSocketTransport(url: string)
```

**Parameters:**
- `url`: WebSocket server URL (e.g., `"ws://localhost:3000"` or `"wss://api.example.com"`)

#### Methods

##### `connect(onReceive: (msg: unknown) => void): Promise<void>`

Establishes the WebSocket connection and starts listening for messages.

```typescript
await transport.connect((message) => {
  console.log("Received:", message);
});
```

**Returns:** Promise that resolves when the connection is established.

##### `send(msg: unknown): Promise<void>`

Sends a message to the server.

```typescript
await transport.send({
  type: "op",
  op: [{ i: "Hello" }],
  revision: 0
});
```

**Throws:** Error if the transport is disconnected.

##### `disconnect(): Promise<void>`

Closes the WebSocket connection.

```typescript
await transport.disconnect();
```

## Message Protocol

Messages are JSON-encoded and follow this format:

### Client → Server
```json
{
  "type": "op",
  "op": [{ "i": "Hello" }],
  "revision": 5
}
```

### Server → Client
```json
{
  "type": "ack"
}
```

```json
{
  "type": "op",
  "op": [{ "i": "World" }],
  "revision": 6
}
```

## Connection Lifecycle

```typescript
const transport = new WebSocketTransport("ws://localhost:3000");

// 1. Connect
await transport.connect((msg) => {
  console.log("Message:", msg);
});

// 2. Send/Receive
await transport.send({ type: "op", ... });

// 3. Disconnect (cleanup)
await transport.disconnect();
```

## Error Handling

The transport handles connection errors and reconnection attempts:

```typescript
try {
  await transport.connect(onReceive);
} catch (err) {
  console.error("Failed to connect:", err);
  // Implement retry logic
}
```

## Production Deployment

### Secure WebSockets (WSS)

Always use `wss://` in production for encrypted connections:

```typescript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const url = `${protocol}//${window.location.host}`;
const transport = new WebSocketTransport(url);
```

### Load Balancing

WebSocket connections are stateful. Use sticky sessions or Redis Pub/Sub for multi-instance deployments:

```typescript
import Redis from "ioredis";

const redis = new Redis();
const redisSub = new Redis();

redisSub.subscribe("ot:updates");

redisSub.on("message", (channel, message) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
});

// When processing an operation
const update = JSON.stringify({ type: "op", ... });
await redis.publish("ot:updates", update);
```

### Heartbeat / Ping-Pong

Prevent connection timeouts with periodic pings:

```typescript
wss.on("connection", (ws) => {
  const interval = setInterval(() => {
    if (ws.readyState === 1) {
      ws.ping();
    }
  }, 30000);

  ws.on("close", () => {
    clearInterval(interval);
  });
});
```

## Next.js Integration

WebSockets require a custom server in Next.js:

```typescript
// server.ts
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ server });
  
  // ... WebSocket logic

  server.listen(3000);
});
```

See the [Next.js + WebSocket Integration Guide](/docs/integrations/nextjs-websocket) for a complete example.

## Browser Compatibility

WebSockets are supported in all modern browsers. For Node.js environments, the `ws` package is required.

## Comparison with SSE

| Feature | WebSocket | SSE |
|---------|-----------|-----|
| Bidirectional | ✅ Yes | ❌ No (client → server via HTTP) |
| Latency | Lower | Slightly higher |
| Serverless | ❌ Requires long-lived process | ✅ Works on Vercel/Lambda |
| Browser Support | Excellent | Excellent |
| Complexity | Moderate | Low |

**Use WebSocket when:**
- You need the lowest latency
- You have a traditional server environment
- You need bidirectional streaming

**Use SSE when:**
- Deploying to serverless platforms
- Simplicity is preferred
- Slightly higher latency is acceptable

## See Also

- [Next.js + WebSocket Integration Guide](/docs/integrations/nextjs-websocket)
- [React + WebSocket Integration Guide](/docs/integrations/react-ws)
- [@open-ot/transport-http-sse](../transport-http-sse) - SSE transport for serverless
