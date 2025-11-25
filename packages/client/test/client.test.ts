import { describe, it, expect, beforeEach } from "vitest";
import { OTClient } from "../src/client";
import { TextType, TextOperation } from "@open-ot/core";

describe("OTClient", () => {
  let client: OTClient<string, TextOperation>;

  beforeEach(() => {
    client = new OTClient({
      type: TextType,
      initialRevision: 0,
      initialSnapshot: "Hello",
    });
  });

  it("should initialize correctly", () => {
    expect(client.getSnapshot()).toBe("Hello");
    expect(client.getRevision()).toBe(0);
  });

  it("should handle local edits (Synchronized -> AwaitingConfirm)", () => {
    const op: TextOperation = [{ r: 5 }, { i: " World" }];
    const sentOp = client.applyLocal(op);

    expect(sentOp).toEqual(op);
    expect(client.getSnapshot()).toBe("Hello World");
  });

  it("should buffer edits (AwaitingConfirm -> AwaitingWithBuffer)", () => {
    // 1. First edit
    const op1: TextOperation = [{ r: 5 }, { i: " World" }];
    client.applyLocal(op1);

    // 2. Second edit (buffered)
    const op2: TextOperation = [{ r: 11 }, { i: "!" }];
    const sentOp = client.applyLocal(op2);

    expect(sentOp).toBeNull(); // Should not send yet
    expect(client.getSnapshot()).toBe("Hello World!");
  });

  it("should send buffered op after ACK", () => {
    // 1. First edit
    const op1: TextOperation = [{ r: 5 }, { i: " World" }];
    client.applyLocal(op1);

    // 2. Second edit (buffered)
    const op2: TextOperation = [{ r: 11 }, { i: "!" }];
    client.applyLocal(op2);

    // 3. ACK first edit
    const nextOp = client.serverAck();

    expect(client.getRevision()).toBe(1);
    expect(nextOp).toEqual(op2); // Should send the buffered op now
  });

  it("should handle remote ops in Synchronized state", () => {
    const remoteOp: TextOperation = [{ i: "Big " }, { r: 5 }];
    const appliedOp = client.applyRemote(remoteOp);

    expect(appliedOp).toEqual(remoteOp);
    expect(client.getSnapshot()).toBe("Big Hello");
    expect(client.getRevision()).toBe(1);
  });

  it("should transform remote ops in AwaitingConfirm state", () => {
    // Initial: "Hello"
    // Local: "Hello World" (insert " World" at 5)
    const localOp: TextOperation = [{ r: 5 }, { i: " World" }];
    client.applyLocal(localOp);

    // Remote: "Big Hello" (insert "Big " at 0)
    // This happens concurrently with localOp
    const remoteOp: TextOperation = [{ i: "Big " }, { r: 5 }];

    const appliedOp = client.applyRemote(remoteOp);

    // Remote op `insert 'Big '` at 0 is transformed against the pending local op.
    // The remote op's `retain` component is adjusted to match the current local snapshot length (11) after the local op.
    // The transformed remote op is `insert 'Big ' at 0, retain 11`.
    // The transformed local op is `retain 9, insert ' World'`.
    // The local op is then applied to the local snapshot, resulting in `Big Hello World`.

    expect(appliedOp).toEqual([{ i: "Big " }, { r: 11 }]);
    expect(client.getSnapshot()).toBe("Big Hello World");
  });

  it("should transform remote ops in AwaitingWithBuffer state", () => {
    // Initial: "Hello"
    // 1. Local 1 (Pending): "Hello World" (insert " World" at 5)
    const op1: TextOperation = [{ r: 5 }, { i: " World" }];
    client.applyLocal(op1);

    // 2. Local 2 (Buffer): "Hello World!" (insert "!" at 11)
    const op2: TextOperation = [{ r: 11 }, { i: "!" }];
    client.applyLocal(op2);

    // 3. Remote: "Big Hello" (insert "Big " at 0)
    // Concurrent with both local ops
    const remoteOp: TextOperation = [{ i: "Big " }, { r: 5 }];

    const appliedOp = client.applyRemote(remoteOp);

    // Remote op `insert 'Big '` at 0 is transformed against the pending local op.
    // The remote op's `retain` component is adjusted to match the current local snapshot length (12) after the local op.
    // The transformed remote op is `insert 'Big ' at 0, retain 12`.
    // The transformed local op is `retain 9, insert ' World'`.
    // The local op is then applied to the local snapshot, resulting in `Big Hello World!`.

    expect(appliedOp).toEqual([{ i: "Big " }, { r: 12 }]); // r: 12 because local snapshot was 12 chars ("Hello World!")
    expect(client.getSnapshot()).toBe("Big Hello World!");
  });

  it("should handle multiple remote ops in AwaitingConfirm state", () => {
    // Initial: "Hello"
    // Local: "Hello World"
    client.applyLocal([{ r: 5 }, { i: " World" }]);

    // Remote 1: "Big Hello"
    client.applyRemote([{ i: "Big " }, { r: 5 }]);

    // Remote 2: "Big Hello?" (insert "?" at 9)
    // Note: Remote 2 is based on "Big Hello" (length 9)
    // Local snapshot is "Big Hello World" (length 15)
    // Pending op is now: retain 9, insert " World"
    // Remote 2 needs to be transformed against pending op.
    // Remote 2: retain 9, insert "?"
    // Pending: retain 9, insert " World"
    // Both are inserting at end of "Big Hello".
    // Tie break?
    // If remote 2 is "right", it comes after pending?
    // Let's assume standard behavior.

    const remoteOp2: TextOperation = [{ r: 9 }, { i: "?" }];
    const appliedOp2 = client.applyRemote(remoteOp2);

    expect(client.getSnapshot()).toBe("Big Hello? World");
  });

  it("should throw error when calling serverAck in Synchronized state", () => {
    expect(() => client.serverAck()).toThrow(
      "Cannot call serverAck in Synchronized state"
    );
  });
});
