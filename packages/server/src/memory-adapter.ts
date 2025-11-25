import { IBackendAdapter, DocumentRecord } from "./interfaces";

export class MemoryBackend implements IBackendAdapter {
  private documents: Map<string, DocumentRecord> = new Map();
  private history: Map<string, unknown[]> = new Map();

  constructor() {}

  public async createDocument(
    docId: string,
    type: string,
    initialSnapshot: unknown
  ) {
    this.documents.set(docId, {
      type,
      v: 0,
      data: initialSnapshot,
    });
    this.history.set(docId, []);
  }

  async getRecord(docId: string): Promise<DocumentRecord> {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }
    return doc;
  }

  async getHistory(
    docId: string,
    start: number,
    end?: number
  ): Promise<unknown[]> {
    const ops = this.history.get(docId) || [];
    return ops.slice(start, end);
  }

  async saveOperation(
    docId: string,
    op: unknown,
    newRevision: number
  ): Promise<void> {
    const doc = this.documents.get(docId);
    if (!doc) {
      throw new Error(`Document ${docId} not found`);
    }

    if (doc.v + 1 !== newRevision) {
      throw new Error(
        `Concurrency error: Expected revision ${doc.v + 1}, got ${newRevision}`
      );
    }

    const ops = this.history.get(docId) || [];
    ops.push(op);

    doc.v = newRevision;
    // In this memory adapter, we treat the backend primarily as an op log.
    // We update the document revision, but the `data` (snapshot) in `DocumentRecord`
    // remains the initial snapshot. The `Server` class is responsible for applying
    // operations to maintain an up-to-date snapshot if needed, as `saveOperation`
    // does not include an updated snapshot.
  }
}
