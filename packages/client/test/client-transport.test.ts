import { describe, it, expect, beforeEach, vi } from "vitest";
import { OTClient } from "../src/client";
import { TextType } from "@open-ot/core";
import { TransportAdapter } from "@open-ot/core";

class MockTransport implements TransportAdapter<unknown> {
  public onReceive: ((msg: unknown) => void) | null = null;
  public sentMessages: unknown[] = [];

  async connect(onReceive: (msg: unknown) => void): Promise<void> {
    this.onReceive = onReceive;
  }

  async send(msg: unknown): Promise<void> {
    this.sentMessages.push(msg);
  }

  async disconnect(): Promise<void> {}

  // Helper to simulate incoming message
  receive(msg: unknown) {
    if (this.onReceive) {
      this.onReceive(msg);
    }
  }
}

describe("OTClient with Transport", () => {
  let client: OTClient<string, any>;
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
    client = new OTClient({
      type: TextType,
      initialRevision: 0,
      initialSnapshot: "Hello",
      transport: transport,
    });
  });

  it("should send operation when applyLocal is called", () => {
    const op = [{ i: " World" }];
    client.applyLocal(op);

    expect(transport.sentMessages).toHaveLength(1);
    expect(transport.sentMessages[0]).toEqual({
      type: "op",
      op: op,
      revision: 0,
    });
  });

  it("should handle server ACK via transport", () => {
    const op = [{ i: " World" }];
    client.applyLocal(op);

    // Simulate ACK
    transport.receive({ type: "ack" });

    expect(client.getRevision()).toBe(1);
    // Should be Synchronized now
    // We can check internal state if we exposed it, or check behavior
    // If we apply another local op, it should send immediately
    const op2 = [{ i: "!" }];
    client.applyLocal(op2);
    expect(transport.sentMessages).toHaveLength(2);
  });

  it("should handle remote operation via transport", () => {
    // Simulate remote op
    const remoteOp = [{ i: "Big " }];
    transport.receive({ type: "op", op: remoteOp });

    expect(client.getSnapshot()).toBe("Big Hello");
    expect(client.getRevision()).toBe(1);
  });

  it("should send buffered operation after ACK", () => {
    // 1. Apply local (sends)
    client.applyLocal([{ i: "A" }]);
    expect(transport.sentMessages).toHaveLength(1);

    // 2. Apply another local (buffers)
    client.applyLocal([{ i: "B" }]);
    expect(transport.sentMessages).toHaveLength(1); // Still 1

    // 3. Receive ACK for first
    transport.receive({ type: "ack" });

    // Should have sent the buffered op
    expect(transport.sentMessages).toHaveLength(2);
    expect(transport.sentMessages[1]).toEqual({
      type: "op",
      op: [{ i: "B" }],
      revision: 1, // Revision incremented after ACK
    });
  });
});
