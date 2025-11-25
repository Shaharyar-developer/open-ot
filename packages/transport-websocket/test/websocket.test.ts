import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WebSocketTransport } from "../src/index";
import { WebSocket, WebSocketServer } from "ws";

// We can use a real WebSocket server for testing since 'ws' works in Node.
// Or we can mock it. Real server is more robust for "integration" style testing of the transport.

describe("WebSocketTransport", () => {
  let transport: WebSocketTransport;
  let server: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    // Start a local WS server
    port = 8080 + Math.floor(Math.random() * 1000);
    server = new WebSocketServer({ port });

    transport = new WebSocketTransport(`ws://localhost:${port}`);
  });

  afterEach(async () => {
    await transport.disconnect();
    server.close();
  });

  it("should connect and receive messages", async () => {
    const received: unknown[] = [];

    // Setup server to echo back
    server.on("connection", (ws) => {
      ws.on("message", (msg) => {
        ws.send(msg);
      });
    });

    await transport.connect((msg) => {
      received.push(msg);
    });

    await transport.send({ type: "hello" });

    // Wait a bit for async message
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ type: "hello" });
  });

  it("should fail to send when disconnected", async () => {
    // Don't connect
    await expect(transport.send({})).rejects.toThrow("Transport disconnected");
  });

  it("should handle disconnect", async () => {
    server.on("connection", (ws) => {
      // Do nothing
    });

    await transport.connect(() => {});
    await transport.disconnect();

    await expect(transport.send({})).rejects.toThrow("Transport disconnected");
  });
});
