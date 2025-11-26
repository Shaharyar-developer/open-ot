# @open-ot/transport-http-sse

A Server-Sent Events (SSE) transport adapter for OpenOT, with support for hybrid polling.

## Installation

```bash
npm install @open-ot/transport-http-sse
```

## Usage

### Basic SSE Transport

```typescript
import { HttpSseTransport } from "@open-ot/transport-http-sse";
import { OTClient } from "@open-ot/client";

const transport = new HttpSseTransport("http://localhost:3000/api/ot");
const client = new OTClient({ transport });
```

### Hybrid Transport (SSE + Polling)

The `HybridTransport` automatically switches between SSE and polling based on connection stability and user activity/inactivity to optimize costs and reliability.

```typescript
import { HybridTransport } from "@open-ot/transport-http-sse";
import { OTClient } from "@open-ot/client";

const transport = new HybridTransport({
  docId: "my-document-123",
  baseUrl: "/api/ot",
  inactivityTimeout: 2 * 60 * 1000, // Switch to polling after 2 min inactive
  pollingInterval: 5000,            // Poll every 5 seconds when in polling mode
});

const client = new OTClient({
  // ... other options
  transport: transport,
});
```

## Server-Side Example (Next.js + Redis)

This example demonstrates the **recommended architecture** for production deployments:
1. Use **`@open-ot/adapter-redis`** for robust data persistence, atomic operations, and history storage.
2. Use **Redis Pub/Sub** (via a direct client) for instant real-time updates to connected clients.
3. Implement **Polling** as a fallback mechanism for the `HybridTransport` to ensure reliability even if SSE connections drop or timeout.

This combination ensures scalability, data integrity, and a seamless user experience.

```typescript
// app/api/ot/[[...event]]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { RedisAdapter } from '@open-ot/adapter-redis';

// Initialize Redis Adapter
// The adapter now handles both storage and pub/sub
const redisAdapter = new RedisAdapter(process.env.REDIS_URL!);

// SSE connection timeout (5 minutes to manage costs)
const SSE_TIMEOUT = 5 * 60 * 1000;
const KEEPALIVE_INTERVAL = 30 * 1000;

// GET /api/ot/events?docId=123 - SSE endpoint
// GET /api/ot/poll?docId=123&since=5 - Polling endpoint
export async function GET(req: NextRequest) {
  const { searchParams, pathname } = req.nextUrl;
  const docId = searchParams.get('docId');

  if (!docId) {
    return NextResponse.json({ error: 'docId required' }, { status: 400 });
  }

  // Determine if this is SSE or polling based on path
  const isPolling = pathname.includes('/poll') || searchParams.has('since');

  if (isPolling) {
    return handlePolling(docId, searchParams);
  }

  return handleSSE(docId, req);
}

// POST /api/ot/messages - Send operations
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { docId, type, op, revision } = body;

    if (!docId || !type) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (type === 'op') {
      // Get current document state
      const doc = await redisAdapter.getRecord(docId);

      // Verify revision matches
      if (revision !== doc.v) {
        return NextResponse.json({ 
          error: 'Revision mismatch',
          expected: doc.v,
          received: revision
        }, { status: 409 });
      }

      // Apply operation and save (Atomic in adapter)
      const newRevision = doc.v + 1;
      
      try {
        await redisAdapter.saveOperation(docId, op, newRevision);
      } catch (e: any) {
        if (e.message.includes('Concurrency error')) {
           return NextResponse.json({ error: 'Concurrency error' }, { status: 409 });
        }
        throw e;
      }

      // Broadcast to all clients via pub/sub
      await redisAdapter.publish(`doc:${docId}`, JSON.stringify({
        type: 'op',
        op,
        revision: newRevision,
      }));

      return NextResponse.json({ 
        success: true, 
        revision: newRevision 
      });
    }

    return NextResponse.json({ error: 'Unknown message type' }, { status: 400 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Handle SSE connections
async function handleSSE(docId: string, req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let keepaliveTimer: NodeJS.Timeout | null = null;
      let timeoutTimer: NodeJS.Timeout | null = null;
      let unsubscribe: (() => void) | null = null;

      try {
        // Send initial document state
        const doc = await redisAdapter.getRecord(docId);
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'init',
          snapshot: doc.data,
          revision: doc.v,
        })}\n\n`));

        // Subscribe to Redis pub/sub for updates
        unsubscribe = await redisAdapter.subscribe(`doc:${docId}`, (message) => {
           controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        });

        // Keepalive to prevent connection timeout
        keepaliveTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch (error) {
            // Stream closed
          }
        }, KEEPALIVE_INTERVAL);

        // Force close after timeout to manage costs
        timeoutTimer = setTimeout(() => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'timeout',
            message: 'Connection timeout - please reconnect or switch to polling',
            suggestPolling: true,
          })}\n\n`));
          
          if (keepaliveTimer) clearInterval(keepaliveTimer);
          if (unsubscribe) unsubscribe();
          controller.close();
        }, SSE_TIMEOUT);

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          if (keepaliveTimer) clearInterval(keepaliveTimer);
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (unsubscribe) unsubscribe();
        });

      } catch (error) {
        console.error('SSE error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: 'Server error',
        })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

// Handle polling requests
async function handlePolling(docId: string, searchParams: URLSearchParams) {
  const sinceRevision = parseInt(searchParams.get('since') || '0');

  try {
    const doc = await redisAdapter.getRecord(docId);
    
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    // If no new changes, return quickly
    if (doc.v <= sinceRevision) {
      return NextResponse.json({
        type: 'poll',
        hasUpdates: false,
        revision: doc.v,
      });
    }

    // Get operations since last known revision
    const ops = await redisAdapter.getHistory(docId, sinceRevision, doc.v);
    
    return NextResponse.json({
      type: 'poll',
      hasUpdates: true,
      operations: ops,
      revision: doc.v,
    });
  } catch (error) {
    console.error('Polling error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```