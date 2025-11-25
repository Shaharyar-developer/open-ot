# @open-ot/transport-http-sse

HTTP + Server-Sent Events (SSE) transport adapter for OpenOT. Ideal for serverless environments where long-lived WebSocket connections are not available.

## Installation

```bash
npm install @open-ot/transport-http-sse
```

## Overview

This package provides a `TransportAdapter` implementation that uses:
- **Server-Sent Events (SSE)** for receiving real-time updates from the server
- **HTTP POST** for sending operations to the server

This is perfect for serverless platforms like Vercel, AWS Lambda, or Cloudflare Workers where maintaining WebSocket connections is challenging or expensive.

## Usage

### Client-Side

```typescript
import { HttpSseTransport } from "@open-ot/transport-http-sse";
import { OTClient } from "@open-ot/client";
import { TextType } from "@open-ot/core";

const transport = new HttpSseTransport("/api/ot", {
  eventsPath: "/events",    // SSE endpoint (default: "/events")
  messagesPath: "/messages", // POST endpoint (default: "/messages")
  headers: {                 // Optional custom headers
    "Authorization": "Bearer token123"
  }
});

const client = new OTClient({
  type: TextType,
  initialSnapshot: "",
  initialRevision: 0,
  transport: transport,
});
```

### Server-Side (Next.js Example)

```typescript
// app/api/ot/events/route.ts
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      // Send updates to client
      const data = `data: ${JSON.stringify({ type: "op", op: [...], revision: 1 })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

// app/api/ot/messages/route.ts
export async function POST(req: NextRequest) {
  const msg = await req.json();
  
  if (msg.type === "op") {
    // Process operation with OT server
    // Broadcast to SSE clients
  }
  
  return NextResponse.json({ success: true });
}
```

## API Reference

### `HttpSseTransport`

#### Constructor

```typescript
new HttpSseTransport(baseUrl: string, options?: HttpSseTransportOptions)
```

**Parameters:**
- `baseUrl`: Base URL for the API endpoints (e.g., `"/api/ot"` or `"https://api.example.com/ot"`)
- `options`: Optional configuration object

**Options:**
- `eventsPath?: string` - Path for SSE endpoint (default: `"/events"`)
- `messagesPath?: string` - Path for POST endpoint (default: `"/messages"`)
- `headers?: Record<string, string>` - Custom headers to include in POST requests

#### Methods

##### `connect(onReceive: (msg: unknown) => void): Promise<void>`

Establishes the SSE connection and starts listening for server updates.

```typescript
await transport.connect((message) => {
  console.log("Received:", message);
});
```

##### `send(msg: unknown): Promise<void>`

Sends a message to the server via HTTP POST.

```typescript
await transport.send({
  type: "op",
  op: [{ i: "Hello" }],
  revision: 0
});
```

##### `disconnect(): Promise<void>`

Closes the SSE connection.

```typescript
await transport.disconnect();
```

## Message Protocol

The transport expects messages in this format:

### Client → Server (POST)
```json
{
  "type": "op",
  "op": [...],
  "revision": 5
}
```

### Server → Client (SSE)
```
data: {"type":"op","op":[...],"revision":6}

data: {"type":"ack"}
```

## Authentication

Since the browser's native `EventSource` API doesn't support custom headers for the SSE connection, authentication typically relies on:

1. **Cookies** - Set via `Set-Cookie` header, automatically sent with SSE requests
2. **Query Parameters** - Include auth token in the SSE URL
3. **Custom Headers in POST** - Use the `headers` option for POST requests

```typescript
// Option 1: Query params for SSE
const transport = new HttpSseTransport("/api/ot?token=abc123");

// Option 2: Headers for POST (cookies handle SSE)
const transport = new HttpSseTransport("/api/ot", {
  headers: { "Authorization": "Bearer token123" }
});
```

## Production Considerations

### Keepalive

SSE connections can timeout. Send periodic keepalive messages:

```typescript
// Server-side
setInterval(() => {
  controller.enqueue(new TextEncoder().encode(": keepalive\n\n"));
}, 30000);
```

### Error Handling

The browser automatically reconnects on connection loss. Handle errors gracefully:

```typescript
transport.connect((msg) => {
  // Handle message
}).catch((err) => {
  console.error("Failed to connect:", err);
});
```

### Scaling

For multi-instance deployments, use Redis Pub/Sub to broadcast operations:

```typescript
// When receiving an operation
await redis.publish("ot:updates", JSON.stringify(message));

// Subscribe to broadcast to SSE clients
redisSub.on("message", (channel, message) => {
  sseClients.forEach(client => client.send(message));
});
```

## Browser Compatibility

SSE is supported in all modern browsers. For older browsers, consider a polyfill like [`event-source-polyfill`](https://www.npmjs.com/package/event-source-polyfill).

## See Also

- [Next.js + SSE Integration Guide](/docs/integrations/nextjs-sse)
- [@open-ot/transport-websocket](../transport-websocket) - WebSocket transport for non-serverless environments
