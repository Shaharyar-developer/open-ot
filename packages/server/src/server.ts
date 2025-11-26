import { OTType } from "@open-ot/core";
import { IBackendAdapter } from "./interfaces";

export class Server {
  private backend: IBackendAdapter;
  // We use unknown here because the server can handle heterogeneous types.
  // When we retrieve a type, we cast it based on the document's type string.
  private types: Map<string, OTType<unknown, unknown>> = new Map();

  constructor(backend: IBackendAdapter) {
    this.backend = backend;
  }

  public registerType<Snapshot, Op>(type: OTType<Snapshot, Op>) {
    // We cast to unknown to store it in the map.
    // This is safe because we only retrieve it when we have the matching type string from the document record.
    this.types.set(type.name, type as unknown as OTType<unknown, unknown>);
  }

  /**
   * Handle an operation submitted by a client.
   * @param docId The document ID
   * @param op The operation to apply
   * @param revision The revision the client *thinks* they are building on
   * @returns The transformed operation and the new revision
   */
  public async submitOperation(
    docId: string,
    op: unknown,
    revision: number
  ): Promise<{ op: unknown; revision: number }> {
    const record = await this.backend.getRecord(docId);
    const type = this.types.get(record.type);

    if (!type) {
      throw new Error(`Unknown type: ${record.type}`);
    }

    if (revision > record.v) {
      throw new Error(`Invalid revision: ${revision} > ${record.v}`);
    }

    // 1. Catch Up (Transform)
    // If the client is behind (revision < record.v), we need to transform their op
    // against all operations that happened since 'revision'.

    let finalOp = op;

    if (revision < record.v) {
      const history = await this.backend.getHistory(docId, revision);

      for (const pastOp of history) {
        // Transform the incoming client op against each past op (oldest -> newest).
        // We iteratively update finalOp so it can be applied after each recorded operation.
        // Using side = 'right' indicates the first argument (finalOp) should be treated as
        // the operation that comes later; the side parameter controls tie-breaking for concurrent edits.
        // Note: this assumes `history` is ordered from the earliest to the latest revision.

        finalOp = type.transform(finalOp, pastOp, "right");
      }
    }

    // 2. Apply & Store
    const newRevision = record.v + 1;
    await this.backend.saveOperation(docId, finalOp, newRevision);

    // Note: We are NOT updating the snapshot in the backend in this simple implementation.
    // In a real app, we might want to update the snapshot periodically or on every op.

    return { op: finalOp, revision: newRevision };
  }
}
