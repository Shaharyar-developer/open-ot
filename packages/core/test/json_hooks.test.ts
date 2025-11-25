import { describe, it, expect } from "vitest";
import { createJsonType } from "../src/types/json";
import * as json1 from "ot-json1";

describe("createJsonType with hooks", () => {
  it("should normalize document after apply", () => {
    const hooks = {
      normalize: (doc: json1.Doc | null) => {
        if (
          doc &&
          typeof doc === "object" &&
          !Array.isArray(doc) &&
          "count" in doc &&
          typeof doc.count === "number" &&
          doc.count < 0
        ) {
          return { ...doc, count: 0 };
        }
        return doc;
      },
    };
    const type = createJsonType(hooks);
    const snap = { count: 10 };
    const op = json1.replaceOp(["count"], 10, -5);
    const newSnap = type.apply(snap, op);
    expect(newSnap).toEqual({ count: 0 });
  });

  it("should validate op during transform", () => {
    const hooks = {
      validate: (_op: json1.JSONOp, _doc?: json1.Doc) => {
        // Reject all ops for this test
        return false;
      },
    };
    const type = createJsonType(hooks);
    // Use non-conflicting ops to ensure transform succeeds before validation
    const opA = json1.replaceOp(["keyA"], "init", "a");
    const opB = json1.replaceOp(["keyB"], "init", "b");

    const transformed = type.transform(opA, opB, "left");
    // Expect null because validate returned false
    expect(transformed).toBeNull();
  });

  it("should proactively rewrite ops with transformOp", () => {
    const hooks = {
      transformOp: (_op: json1.JSONOp, doc: json1.Doc | null) => {
        // If doc has "frozen": true, rewrite to identity op (no change)
        if (
          doc &&
          typeof doc === "object" &&
          !Array.isArray(doc) &&
          "frozen" in doc &&
          doc.frozen
        ) {
          // rewriting to a replace of same value is a valid no-op in json1
          return json1.replaceOp(["val"], 1, 1);
        }
        return null; // No rewrite
      },
    };
    const type = createJsonType(hooks);

    const snapFrozen = { frozen: true, val: 1 };
    const op = json1.replaceOp(["val"], 1, 2);
    const newSnap = type.apply(snapFrozen, op);
    expect(newSnap).toEqual({ frozen: true, val: 1 }); // No change

    const snapOk = { frozen: false, val: 1 };
    const newSnapOk = type.apply(snapOk, op);
    expect(newSnapOk).toEqual({ frozen: false, val: 2 });
  });
});
