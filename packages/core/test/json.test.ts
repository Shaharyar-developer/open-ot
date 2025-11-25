import { describe, it, expect } from "vitest";
import { JsonType } from "../src/types/json";
import * as json1 from "ot-json1";

describe("JsonType (ot-json1)", () => {
  describe("create", () => {
    it("should create an empty document", () => {
      expect(JsonType.create()).toBeNull();
    });
  });

  describe("apply", () => {
    it("should set a value at root", () => {
      const snap = null;
      // Replace null with object
      // op: replace root with { foo: "bar" }
      const op = json1.replaceOp([], null, { foo: "bar" });
      const newSnap = JsonType.apply(snap, op);
      expect(newSnap).toEqual({ foo: "bar" });
    });

    it("should set a nested value", () => {
      const snap = { users: { 1: { name: "Alice" } } };
      // Replace "Alice" with "Bob"
      const op = json1.replaceOp(["users", "1", "name"], "Alice", "Bob");
      const newSnap = JsonType.apply(snap, op);
      expect(newSnap).toEqual({ users: { 1: { name: "Bob" } } });
    });

    it("should insert into a list", () => {
      const snap = { todos: ["A", "C"] };
      // Insert "B" at index 1
      const op = json1.insertOp(["todos", 1], "B");
      const newSnap = JsonType.apply(snap, op);
      expect(newSnap).toEqual({ todos: ["A", "B", "C"] });
    });

    it("should delete from a list", () => {
      const snap = { todos: ["A", "B", "C"] };
      // Delete "B" at index 1
      const op = json1.removeOp(["todos", 1]);
      const newSnap = JsonType.apply(snap, op);
      expect(newSnap).toEqual({ todos: ["A", "C"] });
    });
  });

  describe("transform", () => {
    it("should throw on concurrent set of same key (write conflict)", () => {
      // Initial: { key: "Init" }
      // A: "Init" -> "A"
      // B: "Init" -> "B"

      const opA = json1.replaceOp(["key"], "Init", "A");
      const opB = json1.replaceOp(["key"], "Init", "B");

      expect(() => {
        JsonType.transform(opA, opB, "left");
      }).toThrow(/write conflict/i);
    });

    it("should handle concurrent set of different keys", () => {
      const opA = json1.replaceOp(["keyA"], "Init", "A");
      const opB = json1.replaceOp(["keyB"], "Init", "B");

      const aPrime = JsonType.transform(opA, opB, "left");
      const bPrime = JsonType.transform(opB, opA, "right");

      const snap = { keyA: "Init", keyB: "Init" };
      const snapA = JsonType.apply(snap, opA);
      const snapB = JsonType.apply(snap, opB);

      const res1 = JsonType.apply(snapB, aPrime);
      const res2 = JsonType.apply(snapA, bPrime);

      expect(res1).toEqual(res2);
      expect(res1).toEqual({ keyA: "A", keyB: "B" });
    });

    it("should handle concurrent list insert (shift)", () => {
      // Initial: ["A"]
      // A inserts "B" at 0
      // B inserts "C" at 0

      const opA = json1.insertOp(["list", 0], "B");
      const opB = json1.insertOp(["list", 0], "C");

      const aPrime = JsonType.transform(opA, opB, "left");
      const bPrime = JsonType.transform(opB, opA, "right");

      const snap = { list: ["A"] };
      const snapA = JsonType.apply(snap, opA); // ["B", "A"]
      const snapB = JsonType.apply(snap, opB); // ["C", "A"]

      const res1 = JsonType.apply(snapB, aPrime);
      const res2 = JsonType.apply(snapA, bPrime);

      expect(res1).toEqual(res2);
      // Result should contain both B and C
      // Type guard: ensure res1 is an object with a 'list' property
      expect(res1).toBeTruthy();
      expect(typeof res1 === "object" && res1 !== null && "list" in res1).toBe(
        true
      );
      if (typeof res1 === "object" && res1 !== null && "list" in res1) {
        expect(res1.list).toContain("B");
        expect(res1.list).toContain("C");
      }
    });
  });
});
