import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HybridTransport } from "../src/hybrid-transport";

// Mock EventSource
class MockEventSource {
  static shouldFail = false;
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((err: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      if (MockEventSource.shouldFail) {
        if (this.onerror) this.onerror(new Event("error"));
        this.close();
      } else {
        this.readyState = 1; // OPEN
        if (this.onopen) this.onopen();
      }
    }, 0);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  emitMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  emitError(err: Event) {
    if (this.onerror) {
      this.onerror(err);
    }
  }
}

describe("HybridTransport", () => {
  let transport: HybridTransport;
  let mockFetch: any;

  beforeEach(() => {
    MockEventSource.shouldFail = false;
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", MockEventSource);

    // Mock fetch for polling and sending
    mockFetch = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      // Default response
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });

    transport = new HybridTransport({
      docId: "test-doc",
      baseUrl: "http://localhost:3000",
      inactivityTimeout: 1000,
      pollingInterval: 100,
    });
  });

  afterEach(async () => {
    await transport.disconnect();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("should connect using SSE initially", async () => {
    await transport.connect(() => {});
    // Allow connection to open
    await vi.advanceTimersByTimeAsync(0);

    expect(transport.getCurrentMode()).toBe("sse");

    const es = (transport as any).eventSource as MockEventSource;
    expect(es).toBeDefined();
    expect(es.url).toContain("/events?docId=test-doc");
  });

  it("should receive messages via SSE", async () => {
    const received: unknown[] = [];
    await transport.connect((msg) => received.push(msg));
    await vi.advanceTimersByTimeAsync(0);

    const es = (transport as any).eventSource as MockEventSource;
    es.emitMessage({ type: "op", op: [], revision: 1 });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: "op", op: [], revision: 1 });
  });

  it("should switch to polling on timeout message", async () => {
    await transport.connect(() => {});
    await vi.advanceTimersByTimeAsync(0);

    const es = (transport as any).eventSource as MockEventSource;

    // Simulate timeout message
    es.emitMessage({ type: "timeout", suggestPolling: true });

    expect(transport.getCurrentMode()).toBe("polling");
    expect((transport as any).eventSource).toBeNull();
  });

  it("should poll for updates", async () => {
    // Force polling mode
    await transport.connect(() => {});
    (transport as any).switchToPolling();

    // Mock polling response
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("/poll")) {
        return {
          ok: true,
          json: async () => ({
            hasUpdates: true,
            operations: [{ op: ["a"], revision: 2 }],
            revision: 2,
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    const received: any[] = [];
    (transport as any).onReceiveCallback = (msg: any) => received.push(msg);

    // Trigger poll
    await vi.advanceTimersByTimeAsync(100);

    expect(received.length).toBeGreaterThan(0);
    expect(received[0]).toEqual({ type: "op", op: ["a"], revision: 2 });
  });

  it("should switch to polling after inactivity", async () => {
    await transport.connect(() => {});
    await vi.advanceTimersByTimeAsync(0);

    expect(transport.getCurrentMode()).toBe("sse");

    // Advance time past inactivity timeout
    await vi.advanceTimersByTimeAsync(1100);

    expect(transport.getCurrentMode()).toBe("polling");
  });

  it("should switch back to SSE on activity (send)", async () => {
    await transport.connect(() => {});
    (transport as any).switchToPolling();
    expect(transport.getCurrentMode()).toBe("polling");

    // Send a message
    await transport.send({ type: "op", op: [] });

    // Allow SSE connection to establish
    await vi.advanceTimersByTimeAsync(0);

    expect(transport.getCurrentMode()).toBe("sse");
  });

  it("should reconnect SSE on error", async () => {
    await transport.connect(() => {});
    await vi.advanceTimersByTimeAsync(0);

    const es = (transport as any).eventSource as MockEventSource;

    // Spy on connectSSE
    const connectSpy = vi.spyOn(transport as any, "connectSSE");

    // Simulate error
    es.emitError(new Event("error"));

    // Fast forward reconnection delay
    await vi.advanceTimersByTimeAsync(1000);

    expect(connectSpy).toHaveBeenCalled();
  });

  it("should switch to polling after max reconnect attempts", async () => {
    await transport.connect(() => {});
    await vi.advanceTimersByTimeAsync(0);

    // Set mock to fail connections from now on
    MockEventSource.shouldFail = true;

    // Trigger initial error to start the cycle
    const es = (transport as any).eventSource as MockEventSource;
    es.emitError(new Event("error"));

    // We expect 5 retries.
    // 1. Error -> Wait 0ms (attempt 1) -> Connect -> Fail -> Wait 1000ms
    // 2. Connect -> Fail -> Wait 2000ms
    // ...

    // Just advance enough time for all retries to happen
    // 0 + 1000 + 2000 + 3000 + 4000 = 10000ms
    await vi.advanceTimersByTimeAsync(15000);

    // Should have given up and switched to polling
    expect(transport.getCurrentMode()).toBe("polling");
  });
});
