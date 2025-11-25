# @open-ot/core

The foundational package for OpenOT, providing the core interfaces and built-in OT types.

## Overview

`@open-ot/core` defines the `OTType` interface, which is the contract for implementing Operational Transformation on any data structure. It also includes production-ready implementations for **Text** and **JSON** types.

## Installation

```bash
npm install @open-ot/core
```

## What's Included

### Core Interfaces

#### `OTType<Snapshot, Op>`

The fundamental interface that defines how to synchronize a data structure:

```typescript
interface OTType<Snapshot, Op> {
  name: string;
  create(): Snapshot;
  apply(snapshot: Snapshot, op: Op): Snapshot;
  transform(opA: Op, opB: Op, side: 'left' | 'right'): Op;
  compose(opA: Op, opB: Op): Op;
  invert?(op: Op): Op; // Optional
}
```

- **`name`**: Unique identifier for the type (e.g., `"text"`, `"json"`).
- **`create()`**: Returns the initial empty state.
- **`apply(snapshot, op)`**: Applies an operation to a snapshot, producing a new snapshot.
- **`transform(opA, opB, side)`**: Transforms `opA` to apply *after* `opB`. The `side` parameter handles tie-breaking for concurrent inserts.
- **`compose(opA, opB)`**: Merges two consecutive operations into a single efficient operation.
- **`invert(op)`**: (Optional) Generates an operation that undoes the given operation.

#### `TransportAdapter<TMessage>`

Defines the interface for network communication:

```typescript
interface TransportAdapter<TMessage = unknown> {
  connect(onReceive: (msg: TMessage) => void): Promise<void>;
  send(msg: TMessage): Promise<void>;
  disconnect(): Promise<void>;
}
```

### Built-in Types

#### `TextType`

A production-ready OT implementation for plain text using **Retain/Insert/Delete** operations.

**Operation Format:**

```typescript
type TextOperation = Array<
  | { r: number }      // Retain n characters
  | { i: string }      // Insert string
  | { d: number }      // Delete n characters
>;
```

**Example:**

```typescript
import { TextType } from '@open-ot/core';

const snapshot = "Hello World";
const op = [
  { r: 6 },           // Retain "Hello "
  { i: "Beautiful " }, // Insert "Beautiful "
  { r: 5 }            // Retain "World"
];

const result = TextType.apply(snapshot, op);
// => "Hello Beautiful World"
```

**Features:**
- Efficient composition and transformation
- Handles concurrent edits with tie-breaking
- Normalizes operations to minimize size
- Validates operations for correctness

#### `JsonType`

A wrapper around the battle-tested [`ot-json1`](https://github.com/ottypes/json1) library for collaborative JSON editing.

**Example:**

```typescript
import { JsonType } from '@open-ot/core';

const snapshot = { users: ["Alice"] };
const op = [
  { p: ["users", 1], li: "Bob" } // Insert "Bob" at index 1
];

const result = JsonType.apply(snapshot, op);
// => { users: ["Alice", "Bob"] }
```

**Advanced: Custom JSON Type with Hooks**

You can create a custom JSON type with semantic validation:

```typescript
import { createJsonType } from '@open-ot/core';

const CustomJsonType = createJsonType({
  validate: (op, doc) => {
    // Reject operations that violate your schema
    return isValidSchema(doc);
  },
  normalize: (doc) => {
    // Post-process the document after applying an operation
    return sortKeys(doc);
  }
});
```

## Creating Your Own Type

To synchronize a custom data structure, implement the `OTType` interface:

```typescript
import { OTType } from '@open-ot/core';

interface MySnapshot {
  // Your data structure
}

type MyOp = {
  // Your operation format
};

export const MyCustomType: OTType<MySnapshot, MyOp> = {
  name: 'my-custom-type',
  
  create() {
    return { /* initial state */ };
  },
  
  apply(snapshot, op) {
    // Apply the operation to the snapshot
    return newSnapshot;
  },
  
  transform(opA, opB, side) {
    // Transform opA to apply after opB
    return transformedOpA;
  },
  
  compose(opA, opB) {
    // Merge two consecutive operations
    return composedOp;
  }
};
```

## Use Cases

- **Text Editors**: Use `TextType` for collaborative plain text editing.
- **Rich Text Editors**: Serialize ProseMirror/Lexical state to JSON and use `JsonType`.
- **Configuration Tools**: Sync JSON configuration files in real-time.
- **Custom Data Structures**: Implement your own `OTType` for domain-specific collaboration (e.g., whiteboards, spreadsheets).

## API Reference

### TextType

- `TextType.create()` → `""`
- `TextType.apply(snapshot, op)` → `string`
- `TextType.transform(opA, opB, side)` → `TextOperation`
- `TextType.compose(opA, opB)` → `TextOperation`

**Helpers:**
- `isInsert(op)`, `isRetain(op)`, `isDelete(op)` — Type guards
- `getLength(op)` — Get the length of an operation component
- `normalize(op)` — Merge consecutive operations of the same type
- `checkOp(op)` — Validate operation structure

### JsonType

- `JsonType.create()` → `null`
- `JsonType.apply(snapshot, op)` → `json1.Doc`
- `JsonType.transform(opA, opB, side)` → `JsonOp`
- `JsonType.compose(opA, opB)` → `JsonOp`

For detailed JSON operation syntax, see the [ot-json1 documentation](https://github.com/ottypes/json1).

## License

MIT
