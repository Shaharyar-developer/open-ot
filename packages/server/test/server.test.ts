import { describe, it, expect, beforeEach } from "vitest";
import { Server } from "../src/server";
import { MemoryBackend } from "../src/memory-adapter";
import { TextType, TextOperation } from "@open-ot/core";

describe("Server", () => {
  let server: Server;
  let backend: MemoryBackend;

  beforeEach(async () => {
    backend = new MemoryBackend();
    server = new Server(backend);
    server.registerType(TextType);
    await backend.createDocument("doc1", "text", "");
  });

  it("should accept operation on latest revision", async () => {
    const op: TextOperation = [{ i: "Hello" }];
    const result = await server.submitOperation("doc1", op, 0);

    expect(result.revision).toBe(1);
    expect(result.op).toEqual(op);

    const history = await backend.getHistory("doc1", 0);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(op);
  });

  it("should transform concurrent operation", async () => {
    // 1. Client A submits "Hello"
    const opA: TextOperation = [{ i: "Hello" }];
    await server.submitOperation("doc1", opA, 0);

    // 2. Client B submits "World" (concurrently, based on rev 0)
    const opB: TextOperation = [{ i: "World" }];
    const result = await server.submitOperation("doc1", opB, 0);

    // Since opB is concurrent with opA (both based on rev 0) and both insert at 0,
    // the server (acting as 'left' or primary) keeps opA at 0.
    // opB must be transformed to skip opA's insertion.

    expect(result.revision).toBe(2);
    expect(result.op).toEqual([{ r: 5 }, { i: "World" }]);

    const history = await backend.getHistory("doc1", 0);
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual([{ r: 5 }, { i: "World" }]);
  });

  it("should reject invalid revision", async () => {
    const op: TextOperation = [{ i: "Hello" }];
    await expect(server.submitOperation("doc1", op, 1)).rejects.toThrow(
      "Invalid revision"
    );
  });
});
