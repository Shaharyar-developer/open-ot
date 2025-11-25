import { OTType } from "../interfaces";
import * as json1 from "ot-json1";

export type JsonOp = json1.JSONOp;

export interface JsonSemanticHooks {
  /**
   * Post-transform sanity adjustments.
   * Runs after the op has been applied to the snapshot.
   */
  normalize?: (doc: json1.Doc | null) => json1.Doc | null;

  /**
   * Reject ops that violate schema.
   * Runs after transform to check if the transformed op is valid.
   * Note: snapshot might be undefined when called from transform.
   */
  validate?: (op: JsonOp, doc?: json1.Doc) => boolean;

  /**
   * Hook to rewrite ops proactively.
   * Runs before the op is applied to the snapshot.
   */
  transformOp?: (op: JsonOp, doc: json1.Doc | null) => JsonOp | null;
}

export function createJsonType(
  hooks: JsonSemanticHooks = {}
): OTType<json1.Doc | undefined, JsonOp> {
  return {
    name: "json",
    create() {
      return json1.type.create(null);
    },

    apply(snapshot: json1.Doc | undefined, op: JsonOp): json1.Doc | undefined {
      let currentOp = op;
      const currentSnapshot = snapshot ?? null;

      // Hook to rewrite ops proactively
      if (hooks.transformOp) {
        const rewritten = hooks.transformOp(currentOp, currentSnapshot);
        if (rewritten) {
          currentOp = rewritten;
        }
      }

      let next = json1.type.apply(currentSnapshot, currentOp);

      // Post-transform sanity adjustments
      if (hooks.normalize && next !== undefined) {
        next = hooks.normalize(next);
      }
      return next;
    },

    transform(opA: JsonOp, opB: JsonOp, side: "left" | "right"): JsonOp {
      const result = json1.type.transform(opA, opB, side) ?? null;

      // Reject ops that violate schema
      // Note: We pass undefined for doc because transform is stateless in OT
      if (hooks.validate && !hooks.validate(result, undefined)) {
        // drop or rewrite bad op
        // Returning null acts as a no-op in many contexts, or at least an empty op
        return null as unknown as JsonOp;
      }

      return result;
    },

    compose(opA: JsonOp, opB: JsonOp): JsonOp {
      return json1.type.compose(opA, opB);
    },
  };
}

export const JsonType = createJsonType();
