import { TransportAdapter } from "@open-ot/core";

// Declare EventSource for TypeScript if it's not in the lib or global
// We can use a more specific interface for EventSource
interface IEventSource {
  readyState: number;
  onopen: ((this: IEventSource, ev: Event) => any) | null;
  onmessage: ((this: IEventSource, ev: MessageEvent) => any) | null;
  onerror: ((this: IEventSource, ev: Event) => any) | null;
  close(): void;
}

declare const EventSource: {
  new (url: string, eventSourceInitDict?: any): IEventSource;
  prototype: IEventSource;
  readonly CLOSED: number;
  readonly CONNECTING: number;
  readonly OPEN: number;
};

export interface HttpSseTransportOptions {
  eventsPath?: string;
  messagesPath?: string;
  headers?: Record<string, string>;
}

export class HttpSseTransport<M = unknown> implements TransportAdapter<M> {
  private baseUrl: string;
  private eventsPath: string;
  private messagesPath: string;
  private headers: Record<string, string>;
  private eventSource: IEventSource | null = null;
  private onReceiveCallback: ((msg: M) => void) | null = null;
  private isConnected: boolean = false;

  constructor(baseUrl: string, options: HttpSseTransportOptions = {}) {
    // Remove trailing slash from baseUrl if present
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.eventsPath = options.eventsPath || "/events";
    this.messagesPath = options.messagesPath || "/messages";
    this.headers = options.headers || {};
  }

  connect(onReceive: (msg: M) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.eventSource) {
        if (this.eventSource.readyState === 1) {
          // OPEN
          this.onReceiveCallback = onReceive;
          resolve();
          return;
        }
      }

      this.onReceiveCallback = onReceive;
      const url = `${this.baseUrl}${this.eventsPath}`;

      // We assume EventSource is available globally (browser) or polyfilled (Node tests)
      // Note: Standard EventSource does not support custom headers.
      // Authentication usually relies on cookies or query params.
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        resolve();
      };

      this.eventSource.onerror = () => {
        if (!this.isConnected) {
          // If error happens during connection attempt
          reject(new Error("Failed to connect to SSE endpoint"));
          this.disconnect();
        } else {
          // Runtime error (disconnect/reconnect)
          // For now, we might just log or let the browser handle reconnection
        }
      };

      this.eventSource.onmessage = (event: MessageEvent) => {
        if (this.onReceiveCallback && event.data) {
          try {
            const data = JSON.parse(event.data);
            this.onReceiveCallback(data as M);
          } catch (e) {
            // Ignore parse errors
          }
        }
      };
    });
  }

  async send(msg: M): Promise<void> {
    if (!this.isConnected) {
      throw new Error("Transport disconnected");
    }

    const url = `${this.baseUrl}${this.messagesPath}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(msg),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.onReceiveCallback = null;
  }
}
export * from "./hybrid-transport";
