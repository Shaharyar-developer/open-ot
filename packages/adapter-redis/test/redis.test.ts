import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import RedisMock from "ioredis-mock";

// Mock ioredis module
vi.mock("ioredis", () => ({
  default: RedisMock,
}));

// Import after mock
import { RedisAdapter } from "../src/index";

describe("RedisAdapter", () => {
  let adapter: RedisAdapter;

  beforeEach(() => {
    // RedisMock constructor doesn't need arguments but accepts them
    adapter = new RedisAdapter("redis://localhost:6379");
  });

  afterEach(async () => {
    await adapter.close();
  });

  it("should create and retrieve a document", async () => {
    await adapter.createDocument("doc1", "text", "Hello");

    const record = await adapter.getRecord("doc1");
    expect(record).toEqual({
      type: "text",
      v: 0,
      data: "Hello",
    });
  });

  it("should throw when getting a non-existent document", async () => {
    await expect(adapter.getRecord("non-existent")).rejects.toThrow(
      "Document non-existent not found"
    );
  });

  it("should save operations", async () => {
    await adapter.createDocument("doc1", "text", "");

    const op = { i: "Hello" };
    await adapter.saveOperation("doc1", op, 1);

    const record = await adapter.getRecord("doc1");
    expect(record.v).toBe(1);

    const history = await adapter.getHistory("doc1", 0);
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(op);
  });

  it("should retrieve history with ranges", async () => {
    await adapter.createDocument("doc1", "text", "");
    const ops = [{ i: "1" }, { i: "2" }, { i: "3" }];

    await adapter.saveOperation("doc1", ops[0], 1);
    await adapter.saveOperation("doc1", ops[1], 2);
    await adapter.saveOperation("doc1", ops[2], 3);

    // All history
    const all = await adapter.getHistory("doc1", 0);
    expect(all).toEqual(ops);

    // Slice
    const slice = await adapter.getHistory("doc1", 1, 3); // indices 1 and 2
    expect(slice).toEqual([ops[1], ops[2]]);

    // End undefined
    const fromOne = await adapter.getHistory("doc1", 1);
    expect(fromOne).toEqual([ops[1], ops[2]]);
  });

  it("should throw when saving to non-existent document", async () => {
    const op = { i: "Hello" };
    await expect(adapter.saveOperation("non-existent", op, 1)).rejects.toThrow(
      "Document non-existent not found"
    );
  });

  it("should enforce concurrency", async () => {
    await adapter.createDocument("doc1", "text", "");

    const op = { i: "Hello" };
    // Try to save revision 2 when current is 0 (should be 1)
    await expect(adapter.saveOperation("doc1", op, 2)).rejects.toThrow(
      "Concurrency error"
    );
  });

  it("should overwrite existing document on create", async () => {
    await adapter.createDocument("doc1", "text", "Initial");
    await adapter.saveOperation("doc1", { i: "op1" }, 1);

    await adapter.createDocument("doc1", "text", "New");

    const record = await adapter.getRecord("doc1");
    expect(record.v).toBe(0);
    expect(record.data).toBe("New");

    const history = await adapter.getHistory("doc1", 0);
    expect(history).toEqual([]);
  });
});
