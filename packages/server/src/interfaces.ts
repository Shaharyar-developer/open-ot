export interface DocumentRecord {
  type: "text" | "json" | (string & {}); // 'text', 'json', 'custom'
  v: number; // revision
  data: unknown; // The Snapshot
}

export interface IBackendAdapter {
  /** Get the current global revision and type of the document */
  getRecord(docId: string): Promise<DocumentRecord>;

  /** Get a range of past operations for transformation */
  getHistory(docId: string, start: number, end?: number): Promise<unknown[]>;

  /** Atomic commit: Add op to history AND increment revision */
  saveOperation(docId: string, op: unknown, newRevision: number): Promise<void>;
}
