export interface OTType<Snapshot, Op> {
  /**
   * Unique name (e.g., 'text-delta', 'json-patch', 'custom-lexical')
   */
  name: string;

  /**
   * Create the initial empty state of the document
   */
  create(): Snapshot;

  /**
   * Apply an operation to a snapshot to produce a new snapshot
   */
  apply(snapshot: Snapshot, op: Op): Snapshot;

  /**
   * Transform opA against opB.
   * Returns opA', which is opA modified to apply AFTER opB.
   * 'side' determines tie-breaking for symmetric conflicts.
   */
  transform(opA: Op, opB: Op, side: "left" | "right"): Op;

  /**
   * Merge two consecutive operations into one efficient operation
   */
  compose(opA: Op, opB: Op): Op;

  /**
   * Optional: Generate an operation that undoes the given op
   */
  invert?(op: Op): Op;
}

export interface TransportAdapter<TMessage = unknown> {
  /**
   * Establish the connection.
   * The transport begins delivering messages via `onReceive`.
   */
  connect(onReceive: (msg: TMessage) => void): Promise<void>;

  /**
   * Send a message to the server or other peers.
   */
  send(msg: TMessage): Promise<void>;

  /**
   * Close all resources: sockets, streams, timers, etc.
   */
  disconnect(): Promise<void>;
}
