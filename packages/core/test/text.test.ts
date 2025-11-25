import { describe, it, expect } from "vitest";
import { TextType, TextOperation, normalize } from "../src/types/text";

describe("TextType", () => {
  describe("apply", () => {
    it("should apply insert", () => {
      const op: TextOperation = [{ i: "Hello" }];
      expect(TextType.apply("", op)).toBe("Hello");
    });

    it("should apply insert at position", () => {
      const op: TextOperation = [{ r: 5 }, { i: " World" }];
      expect(TextType.apply("Hello", op)).toBe("Hello World");
    });

    it("should apply delete", () => {
      const op: TextOperation = [{ r: 1 }, { d: 1 }, { r: 3 }];
      expect(TextType.apply("Hello", op)).toBe("Hllo");
    });

    it("should apply complex mixed operations", () => {
      // "Hello World" -> "He" (keep 2) + "y" (insert) + "o" (skip 'l', keep 'l', skip 'o') ... wait
      // "Hello World"
      // r: 2 ("He")
      // i: "y"
      // d: 2 ("ll")
      // r: 1 ("o")
      // d: 6 (" World")
      const op: TextOperation = [
        { r: 2 },
        { i: "y" },
        { d: 2 },
        { r: 1 },
        { d: 6 },
      ];
      expect(TextType.apply("Hello World", op)).toBe("Heyo");
    });

    it("should throw on out of bounds retain", () => {
      const op: TextOperation = [{ r: 100 }];
      expect(() => TextType.apply("Short", op)).toThrow(/past the end/);
    });

    it("should throw on out of bounds delete", () => {
      const op: TextOperation = [{ d: 100 }];
      expect(() => TextType.apply("Short", op)).toThrow(/past the end/);
    });

    it("should handle empty operations", () => {
      expect(TextType.apply("Test", [])).toBe("Test");
    });
  });

  describe("compose", () => {
    it("should compose two inserts", () => {
      const opA: TextOperation = [{ i: "Hello" }];
      const opB: TextOperation = [{ r: 5 }, { i: " World" }];
      const composed = TextType.compose(opA, opB);
      expect(composed).toEqual([{ i: "Hello World" }]);
    });

    it("should compose insert and delete", () => {
      const opA: TextOperation = [{ i: "Hello" }];
      const opB: TextOperation = [{ r: 1 }, { d: 1 }, { r: 3 }];
      const composed = TextType.compose(opA, opB);
      expect(composed).toEqual([{ i: "Hllo" }]);
    });

    it("should compose delete and insert", () => {
      const opA: TextOperation = [{ d: 5 }];
      const opB: TextOperation = [{ i: "World" }];
      const composed = TextType.compose(opA, opB);
      expect(composed).toEqual([{ d: 5 }, { i: "World" }]);
    });

    it("should compose complex operations", () => {
      // A: "Hello" -> "Hllo" (delete 'e')
      const opA: TextOperation = [{ r: 1 }, { d: 1 }, { r: 3 }];
      // B: "Hllo" -> "Hllo!" (append '!')
      const opB: TextOperation = [{ r: 4 }, { i: "!" }];

      const composed = TextType.compose(opA, opB);
      // Expected: "Hello" -> "Hllo!"
      // r: 1 ('H'), d: 1 ('e'), r: 3 ('llo'), i: '!'
      expect(composed).toEqual([{ r: 1 }, { d: 1 }, { r: 3 }, { i: "!" }]);
    });

    it("should compose operations that cancel out", () => {
      // Insert 'a', then delete 'a'
      const opA: TextOperation = [{ i: "a" }];
      const opB: TextOperation = [{ d: 1 }];
      const composed = TextType.compose(opA, opB);
      expect(composed).toEqual([]);
    });
  });

  describe("transform", () => {
    it("should transform insert vs insert (left wins)", () => {
      const opA: TextOperation = [{ r: 3 }, { i: "A" }];
      const opB: TextOperation = [{ r: 3 }, { i: "B" }];

      const aPrime = TextType.transform(opA, opB, "left");
      // A is left, so A comes first.
      // We want A' such that Apply(B, A') == Apply(A, B')
      // B inserts "B" at 3. Document becomes "...B...".
      // A wanted to insert "A" at 3.
      // Since A is left, "A" should be before "B".
      // So in the new document (with B), "A" should be at 3.
      // Wait, if A is left, it means A happened *before* B in the linear history we are building?
      // No, "left" usually means "server" or "priority".
      // If side='left', opA is prioritized.
      // If we want "A" before "B", then when transforming A against B:
      // B inserted at 3. A inserts at 3.
      // If A is left, A stays at 3. B's insertion pushes everything after 3 by 1.
      // But B inserted AT 3. So the character at 3 is now 'B'.
      // If we want A before B, A should insert at 3.
      // Then B (transformed) would insert at 4.

      expect(aPrime).toEqual([{ r: 3 }, { i: "A" }, { r: 1 }]);
    });

    it("should transform insert vs insert (right yields)", () => {
      const opA: TextOperation = [{ r: 3 }, { i: "A" }];
      const opB: TextOperation = [{ r: 3 }, { i: "B" }];

      const bPrime = TextType.transform(opB, opA, "right");
      // B is right. A inserted "A" at 3.
      // B wants to insert "B" at 3.
      // Since A is left (priority), A comes first.
      // So "A" is at 3. "B" should be after "A".
      // So B' should insert at 3 + len(A) = 4.
      expect(bPrime).toEqual([{ r: 4 }, { i: "B" }]);
    });

    it("should transform insert vs delete", () => {
      // A inserts 'A' at 1
      const opA: TextOperation = [{ r: 1 }, { i: "A" }, { r: 1 }];
      // B deletes 2 chars at 0
      const opB: TextOperation = [{ d: 2 }];

      const aPrime = TextType.transform(opA, opB, "left");
      // B deletes 0 and 1.
      // A inserts at 1.
      // Since 1 is deleted by B, A's insertion point shifts to 0 (start of delete range)?
      // Or does it stay?
      // Usually, if you insert inside a deleted range, it tends to stick to the start or end.
      // Here, 0 is deleted, 1 is deleted.
      // A inserts at 1.
      // The character at 0 is gone. The character at 1 is gone.
      // The insertion 'A' should probably happen at 0.
      expect(aPrime).toEqual([{ i: "A" }]);
    });

    it("should transform delete vs insert", () => {
      // A deletes 2 chars at 0
      const opA: TextOperation = [{ d: 2 }];
      // B inserts 'B' at 1
      const opB: TextOperation = [{ r: 1 }, { i: "B" }, { r: 1 }];

      const aPrime = TextType.transform(opA, opB, "left");
      // B inserts at 1.
      // A deletes 0..2.
      // The insertion B splits the deletion A?
      // Original: 0 1
      // B op: 0 'B' 1
      // A op: delete 0, delete 1.
      // A should delete 0, retain 'B', delete 1.
      expect(aPrime).toEqual([{ d: 1 }, { r: 1 }, { d: 1 }]);
    });

    it("should transform delete vs delete (overlapping)", () => {
      // A deletes 0..2
      const opA: TextOperation = [{ d: 2 }];
      // B deletes 1..3
      const opB: TextOperation = [{ r: 1 }, { d: 2 }];

      const aPrime = TextType.transform(opA, opB, "left");
      // B deletes 1 and 2.
      // A wanted to delete 0 and 1.
      // B already deleted 1.
      // So A only needs to delete 0.
      expect(aPrime).toEqual([{ d: 1 }]);
    });
  });

  describe("normalize", () => {
    it("should merge consecutive retains", () => {
      const op: TextOperation = [{ r: 1 }, { r: 2 }];
      expect(normalize(op)).toEqual([{ r: 3 }]);
    });

    it("should merge consecutive inserts", () => {
      const op: TextOperation = [{ i: "a" }, { i: "b" }];
      expect(normalize(op)).toEqual([{ i: "ab" }]);
    });

    it("should merge consecutive deletes", () => {
      const op: TextOperation = [{ d: 1 }, { d: 2 }];
      expect(normalize(op)).toEqual([{ d: 3 }]);
    });

    it("should remove empty components", () => {
      const op: TextOperation = [{ r: 0 }, { i: "" }, { d: 0 }, { r: 1 }];
      expect(normalize(op)).toEqual([{ r: 1 }]);
    });
  });

  describe("Fuzz / Random Consistency Checks", () => {
    // A simple property-based test to ensure transform convergence
    // Apply(Apply(S, A), B') == Apply(Apply(S, B), A')

    it("should satisfy the diamond property for simple cases", () => {
      const str = "1234567890";

      const cases = [
        {
          opA: [{ r: 5 }, { i: "A" }, { r: 5 }],
          opB: [{ r: 2 }, { d: 2 }, { r: 6 }],
        },
        { opA: [{ d: 1 }, { r: 9 }], opB: [{ r: 9 }, { i: "B" }] },
        {
          opA: [{ r: 2 }, { i: "X" }, { r: 8 }],
          opB: [{ r: 2 }, { i: "Y" }, { r: 8 }],
        },
      ];

      for (const { opA, opB } of cases) {
        const aPrime = TextType.transform(opA, opB, "left");
        const bPrime = TextType.transform(opB, opA, "right");

        const path1 = TextType.apply(TextType.apply(str, opA), bPrime);
        const path2 = TextType.apply(TextType.apply(str, opB), aPrime);

        expect(path1).toBe(path2);
      }
    });
  });
});
