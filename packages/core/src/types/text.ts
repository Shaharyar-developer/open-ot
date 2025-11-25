import { OTType } from "../interfaces";

export type InsertOp = { i: string };
export type RetainOp = { r: number };
export type DeleteOp = { d: number };

export type OpComponent = RetainOp | InsertOp | DeleteOp;
export type TextOperation = OpComponent[];

/**
 * Helper to check if a component is an Insert operation
 */
export const isInsert = (op: OpComponent): op is InsertOp => "i" in op;

/**
 * Helper to check if a component is a Retain operation
 */
export const isRetain = (op: OpComponent): op is RetainOp => "r" in op;

/**
 * Helper to check if a component is a Delete operation
 */
export const isDelete = (op: OpComponent): op is DeleteOp => "d" in op;

/**
 * Get the length of a component.
 * For Insert: length of string.
 * For Retain/Delete: the number value.
 */
export const getLength = (op: OpComponent): number => {
  if (isInsert(op)) return op.i.length;
  if (isRetain(op)) return op.r;
  if (isDelete(op)) return op.d;
  return 0;
};

/**
 * Text OT Type Implementation
 * Follows the standard OT approach for text (Jupiter/Google Wave).
 */
export const TextType: OTType<string, TextOperation> = {
  name: "text",

  create() {
    return "";
  },

  apply(snapshot, op) {
    if (typeof snapshot !== "string") {
      throw new Error("Snapshot must be a string");
    }

    checkOp(op);

    let result = "";
    let index = 0;

    for (const component of op) {
      if (isInsert(component)) {
        result += component.i;
      } else if (isRetain(component)) {
        if (index + component.r > snapshot.length) {
          throw new Error(
            `Operation goes past the end of the string. Index: ${index}, Retain: ${component.r}, Snapshot Length: ${snapshot.length}`
          );
        }
        result += snapshot.slice(index, index + component.r);
        index += component.r;
      } else if (isDelete(component)) {
        if (index + component.d > snapshot.length) {
          throw new Error(
            `Operation goes past the end of the string. Index: ${index}, Delete: ${component.d}, Snapshot Length: ${snapshot.length}`
          );
        }
        index += component.d;
      }
    }

    // In strict OT, the operation should cover the entire document (with retains).
    // However, for robustness in this implementation, we append the remaining text
    // if the operation didn't traverse the whole string.
    if (index < snapshot.length) {
      result += snapshot.slice(index);
    }

    return result;
  },

  transform(opA, opB, side) {
    checkOp(opA);
    checkOp(opB);

    const newOp: TextOperation = [];

    let iA = 0;
    let iB = 0;
    let offsetA = 0;
    let offsetB = 0;

    const lenA = opA.length;
    const lenB = opB.length;

    // Implicit retain component to use when an operation is exhausted
    const implicitRetain: RetainOp = { r: Infinity };

    while (iA < lenA || iB < lenB) {
      const cA = iA < lenA ? opA[iA]! : implicitRetain;
      const cB = iB < lenB ? opB[iB]! : implicitRetain;

      // Handle Inserts immediately
      if (isInsert(cA)) {
        // A inserts.
        // If B also inserts, we need to decide order based on 'side'.
        if (isInsert(cB)) {
          if (side === "left") {
            // Left side wins, insert A first
            append(newOp, { i: cA.i });
            iA++;
          } else {
            // Right side yields, push B's length as retain (transforming A against B)
            append(newOp, { r: getLength(cB) });
            iB++;
          }
        } else {
          // B is not inserting (or is null/implicit), so A's insert just happens.
          append(newOp, { i: cA.i });
          iA++;
        }
        continue;
      }

      if (isInsert(cB)) {
        // B inserts. A is not inserting (handled above).
        // A must retain B's insertion to keep indices aligned in the new document state (after B).
        append(newOp, { r: getLength(cB) });
        iB++;
        continue;
      }

      // Now dealing with Retain/Delete vs Retain/Delete
      // Since we use implicitRetain, cA and cB are never null here.

      const lengthA = getLength(cA) - offsetA;
      const lengthB = getLength(cB) - offsetB;
      const minLen = Math.min(lengthA, lengthB);

      if (isRetain(cA) && isRetain(cB)) {
        append(newOp, { r: minLen });
      } else if (isDelete(cA) && isRetain(cB)) {
        append(newOp, { d: minLen });
      } else if (isRetain(cA) && isDelete(cB)) {
        // A retains, B deletes. A's retain is "eaten" by B's delete.
        // We do nothing.
      } else if (isDelete(cA) && isDelete(cB)) {
        // Both delete. A's delete is redundant because B also deleted it.
        // We do nothing.
      }

      // Advance offsets
      offsetA += minLen;
      offsetB += minLen;

      // Advance iterators if fully consumed
      if (iA < lenA && offsetA >= getLength(cA)) {
        iA++;
        offsetA = 0;
      }
      if (iB < lenB && offsetB >= getLength(cB)) {
        iB++;
        offsetB = 0;
      }
    }

    return normalize(newOp);
  },

  compose(opA, opB) {
    checkOp(opA);
    checkOp(opB);

    const newOp: TextOperation = [];

    let iA = 0;
    let iB = 0;
    let offsetA = 0;
    let offsetB = 0;

    const lenA = opA.length;
    const lenB = opB.length;

    const implicitRetain: RetainOp = { r: Infinity };

    while (iA < lenA || iB < lenB) {
      const cA = iA < lenA ? opA[iA]! : implicitRetain;
      const cB = iB < lenB ? opB[iB]! : implicitRetain;

      // If A deletes, it happens before B sees it.
      if (isDelete(cA)) {
        append(newOp, { d: cA.d });
        iA++;
        continue;
      }

      // If B inserts, it happens after A.
      if (isInsert(cB)) {
        append(newOp, { i: cB.i });
        iB++;
        continue;
      }

      // A is Retain or Insert (or implicit Retain)
      // B is Retain or Delete (or implicit Retain)

      const lengthA = getLength(cA) - offsetA;
      const lengthB = getLength(cB) - offsetB;
      const minLen = Math.min(lengthA, lengthB);

      if (isRetain(cA)) {
        if (isRetain(cB)) {
          append(newOp, { r: minLen });
        } else if (isDelete(cB)) {
          append(newOp, { d: minLen });
        }
      } else if (isInsert(cA)) {
        if (isRetain(cB)) {
          append(newOp, { i: cA.i.substr(offsetA, minLen) });
        } else if (isDelete(cB)) {
          // A inserted, but B deleted it immediately.
          // It effectively never happened.
        }
      }

      offsetA += minLen;
      offsetB += minLen;

      if (iA < lenA && offsetA >= getLength(cA)) {
        iA++;
        offsetA = 0;
      }
      if (iB < lenB && offsetB >= getLength(cB)) {
        iB++;
        offsetB = 0;
      }
    }

    return normalize(newOp);
  },
};

/**
 * Appends a component to the operation, merging if possible.
 */
function append(op: TextOperation, component: OpComponent) {
  if (isRetain(component) && component.r === 0) return;
  if (isInsert(component) && component.i === "") return;
  if (isDelete(component) && component.d === 0) return;

  if (op.length === 0) {
    op.push(component);
    return;
  }

  const last = op[op.length - 1]!;

  if (isRetain(last) && isRetain(component)) {
    last.r += component.r;
  } else if (isInsert(last) && isInsert(component)) {
    last.i += component.i;
  } else if (isDelete(last) && isDelete(component)) {
    last.d += component.d;
  } else {
    op.push(component);
  }
}

/**
 * Normalize an operation: merge consecutive components of same type, remove empty ones.
 */
export function normalize(op: TextOperation): TextOperation {
  const newOp: TextOperation = [];
  for (const c of op) {
    append(newOp, { ...c }); // Clone to avoid mutating original components if they are shared
  }
  return newOp;
}

/**
 * Validate operation structure
 */
export function checkOp(op: TextOperation) {
  if (!Array.isArray(op)) throw new Error("Operation must be an array");
  for (const c of op) {
    if (typeof c !== "object")
      throw new Error("Operation component must be an object");
    if (!isInsert(c) && !isRetain(c) && !isDelete(c)) {
      throw new Error("Operation component must be Insert, Retain, or Delete");
    }
  }
}
