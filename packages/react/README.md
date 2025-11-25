# @open-ot/react

React hooks for OpenOT. Provides a clean, idiomatic way to integrate Operational Transformation into React applications.

## Installation

```bash
npm install @open-ot/react @open-ot/client @open-ot/core
```

## Overview

This package provides React-specific bindings for OpenOT, allowing you to build collaborative applications with minimal boilerplate. The core `useOTClient` hook manages the OT client lifecycle and provides reactive state updates.

## Why a Separate Package?

`@open-ot/client` is framework-agnostic by design. This package adds React-specific functionality without coupling the core library to any framework. This architecture allows for future framework integrations (`@open-ot/vue`, `@open-ot/svelte`, etc.) following the same pattern.

## Quick Start

```tsx
import { useOTClient } from "@open-ot/react";
import { WebSocketTransport } from "@open-ot/transport-websocket";
import { TextType } from "@open-ot/core";
import { useMemo } from "react";

function CollaborativeEditor() {
  const transport = useMemo(
    () => new WebSocketTransport("ws://localhost:3000"),
    []
  );

  const { client, snapshot } = useOTClient({
    type: TextType,
    initialSnapshot: "Hello, world!",
    initialRevision: 0,
    transport: transport,
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    // Generate operation (use a diffing library in production)
    const op = generateOp(snapshot, newText);
    client.applyLocal(op);
  };

  return (
    <textarea value={snapshot} onChange={handleChange} />
  );
}
```

## API Reference

### `useOTClient<Snapshot, Op>(options)`

The main hook for integrating OpenOT into React components.

#### Parameters

```typescript
interface OTClientOptions<Snapshot, Op> {
  type: OTType<Snapshot, Op>;
  initialRevision: number;
  initialSnapshot: Snapshot;
  transport?: TransportAdapter;
}
```

- `type`: The OT type (e.g., `TextType`, `JsonType`)
- `initialRevision`: Starting revision number (usually `0`)
- `initialSnapshot`: Initial document state
- `transport`: Optional transport adapter for network sync

#### Returns

```typescript
{
  client: OTClient<Snapshot, Op>;
  snapshot: Snapshot;
}
```

- `client`: The OT client instance for applying local operations
- `snapshot`: The current document state (reactive)

#### Example

```tsx
const { client, snapshot } = useOTClient({
  type: TextType,
  initialSnapshot: "",
  initialRevision: 0,
  transport: new WebSocketTransport("ws://localhost:3000"),
});
```

## Usage Patterns

### Text Editor

```tsx
import { useOTClient } from "@open-ot/react";
import { TextType } from "@open-ot/core";
import { useMemo } from "react";

function TextEditor() {
  const transport = useMemo(
    () => new WebSocketTransport("ws://localhost:3000"),
    []
  );

  const { client, snapshot } = useOTClient({
    type: TextType,
    initialSnapshot: "",
    initialRevision: 0,
    transport,
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    
    // Simple append/delete logic (use fast-diff in production)
    if (newText.startsWith(snapshot)) {
      const inserted = newText.slice(snapshot.length);
      client.applyLocal([{ r: snapshot.length }, { i: inserted }]);
    } else if (snapshot.startsWith(newText)) {
      const deleted = snapshot.length - newText.length;
      client.applyLocal([{ r: newText.length }, { d: deleted }]);
    }
  };

  return (
    <textarea
      value={snapshot}
      onChange={handleChange}
      className="w-full h-64 p-4 font-mono"
    />
  );
}
```

### JSON Document

```tsx
import { useOTClient } from "@open-ot/react";
import { JsonType } from "@open-ot/core";

function JsonEditor() {
  const { client, snapshot } = useOTClient({
    type: JsonType,
    initialSnapshot: { count: 0 },
    initialRevision: 0,
  });

  const increment = () => {
    client.applyLocal([
      { p: ["count"], na: 1 } // Numeric add
    ]);
  };

  return (
    <div>
      <p>Count: {snapshot.count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}
```

### Fetching Initial State

In production, fetch the initial snapshot and revision from your API:

```tsx
function Editor() {
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    fetch("/api/document/123")
      .then(res => res.json())
      .then(data => setInitialData(data));
  }, []);

  if (!initialData) return <div>Loading...</div>;

  return <EditorInner initialData={initialData} />;
}

function EditorInner({ initialData }) {
  const { client, snapshot } = useOTClient({
    type: TextType,
    initialSnapshot: initialData.snapshot,
    initialRevision: initialData.revision,
    transport: new WebSocketTransport("ws://localhost:3000"),
  });

  // ... rest of component
}
```

## Best Practices

### 1. Memoize Transport

Always wrap your transport in `useMemo` to prevent reconnections on every render:

```tsx
const transport = useMemo(
  () => new WebSocketTransport("ws://localhost:3000"),
  []
);
```

### 2. Use a Diffing Library

For text editing, use a proper diffing library like [`fast-diff`](https://github.com/jhchen/fast-diff) to generate operations:

```tsx
import diff from "fast-diff";

function generateTextOp(oldText: string, newText: string) {
  const diffs = diff(oldText, newText);
  const op = [];
  let index = 0;

  for (const [type, text] of diffs) {
    if (type === diff.EQUAL) {
      if (text.length > 0) op.push({ r: text.length });
      index += text.length;
    } else if (type === diff.INSERT) {
      op.push({ i: text });
    } else if (type === diff.DELETE) {
      op.push({ d: text.length });
    }
  }

  return op;
}
```

### 3. Handle Cleanup

The hook automatically cleans up the transport on unmount, but ensure you're not creating new transports unnecessarily.

### 4. Separate Concerns

Keep your OT logic separate from your UI logic:

```tsx
// hooks/useCollaborativeText.ts
export function useCollaborativeText(docId: string) {
  const transport = useMemo(
    () => new WebSocketTransport(`ws://localhost:3000/${docId}`),
    [docId]
  );

  return useOTClient({
    type: TextType,
    initialSnapshot: "",
    initialRevision: 0,
    transport,
  });
}

// components/Editor.tsx
function Editor({ docId }: { docId: string }) {
  const { client, snapshot } = useCollaborativeText(docId);
  // ... UI logic
}
```

## TypeScript

The hook is fully typed and infers types from your OT type:

```tsx
import { TextType } from "@open-ot/core";

// snapshot is inferred as string
const { snapshot } = useOTClient({
  type: TextType,
  initialSnapshot: "",
  initialRevision: 0,
});

// snapshot is inferred as { count: number }
const { snapshot } = useOTClient({
  type: JsonType,
  initialSnapshot: { count: 0 },
  initialRevision: 0,
});
```

## Integration Guides

- [React + WebSocket](/docs/integrations/react-ws)
- [Next.js + SSE](/docs/integrations/nextjs-sse)
- [Next.js + WebSocket](/docs/integrations/nextjs-websocket)

## See Also

- [@open-ot/client](../client) - Framework-agnostic OT client
- [@open-ot/core](../core) - Core OT types and interfaces
- [@open-ot/transport-websocket](../transport-websocket) - WebSocket transport
- [@open-ot/transport-http-sse](../transport-http-sse) - SSE transport
