import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HttpSseTransport } from "../src/index";

// Mock EventSource
class MockEventSource {
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((err: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 0);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Helper to simulate server sending message
  emitMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  // Helper to simulate error
  emitError(err: Event) {
    if (this.onerror) {
      this.onerror(err);
    }
  }
}

describe("HttpSseTransport", () => {
  let transport: HttpSseTransport;
  let mockFetch: any; // Keeping mockFetch as any because vi.spyOn returns a complex type that is hard to type explicitly without importing Vitest types deeply.

  beforeEach(() => {
    // Stub global EventSource
    vi.stubGlobal("EventSource", MockEventSource);

    // Mock global fetch
    mockFetch = vi.spyOn(global, "fetch").mockImplementation(async () => {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({}),
      } as Response;
    });

    transport = new HttpSseTransport("http://localhost:3000");
  });

  afterEach(async () => {
    await transport.disconnect();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should connect and receive messages", async () => {
    const received: unknown[] = [];

    await transport.connect((msg) => {
      received.push(msg);
    });

    // Access the mock instance to emit message
    // We need to get the instance created inside connect.
    // Since we can't easily access private property, we can spy on the constructor or just trust the stub.
    // But wait, `transport` has `eventSource` private property.
    // We can cast to any to access it for testing.
    const es = (transport as any).eventSource as MockEventSource;
    expect(es).toBeDefined();
    expect(es.url).toBe("http://localhost:3000/events");

    es.emitMessage({ type: "hello" });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: "hello" });
  });

  it("should send messages via POST", async () => {
    // Must connect first (logic says send throws if not connected)
    await transport.connect(() => {});

    const msg = { type: "update", payload: 123 };
    await transport.send(msg);

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg),
    });
  });

  it("should throw if send fails", async () => {
    await transport.connect(() => {});

    mockFetch.mockImplementationOnce(async () => {
      return {
        ok: false,
        statusText: "Internal Server Error",
      } as Response;
    });

    await expect(transport.send({})).rejects.toThrow("Failed to send message");
  });

  it("should disconnect", async () => {
    await transport.connect(() => {});
    const es = (transport as any).eventSource as MockEventSource;
    const closeSpy = vi.spyOn(es, "close");

    await transport.disconnect();
    expect(closeSpy).toHaveBeenCalled();
    expect((transport as any).isConnected).toBe(false);
  });
});
