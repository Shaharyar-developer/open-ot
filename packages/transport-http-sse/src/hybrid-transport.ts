import { TransportAdapter } from "@open-ot/core";

export interface HybridTransportOptions {
  docId: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  
  // Inactivity detection
  inactivityTimeout?: number; // Default: 2 minutes
  pollingInterval?: number;    // Default: 5 seconds
  
  // Auto-reconnect settings
  maxReconnectAttempts?: number; // Default: 5
  reconnectDelay?: number;       // Default: 1000ms
}

type ConnectionMode = 'sse' | 'polling' | 'disconnected';

export class HybridTransport<M = unknown> implements TransportAdapter<M> {
  private mode: ConnectionMode = "disconnected";
  private docId: string;
  private baseUrl: string;
  private headers: Record<string, string>;

  private eventSource: EventSource | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();

  private currentRevision: number = 0;
  private onReceiveCallback: ((msg: M) => void) | null = null;

  private inactivityTimeout: number;
  private pollingInterval: number;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private reconnectAttempts: number = 0;

  constructor(options: HybridTransportOptions) {
    this.docId = options.docId;
    this.baseUrl = options.baseUrl || "/api/ot";
    this.headers = options.headers || {};

    this.inactivityTimeout = options.inactivityTimeout || 2 * 60 * 1000; // 2 min
    this.pollingInterval = options.pollingInterval || 5000; // 5 sec
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
  }

  async connect(onReceive: (msg: M) => void): Promise<void> {
    this.onReceiveCallback = onReceive;
    this.resetInactivityTimer();

    // Start with SSE
    await this.connectSSE();
  }

  async send(msg: M): Promise<void> {
    // Mark activity when sending
    this.markActivity();

    const message = msg as any;

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
        body: JSON.stringify({
          docId: this.docId,
          ...message,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Send failed:", error);
        throw new Error(error.error || "Send failed");
      }

      const result = await response.json();

      // Update revision if server returns it
      if (result.revision !== undefined) {
        this.currentRevision = result.revision;
      }
    } catch (error) {
      console.error("Transport send error:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.cleanupSSE();
    this.cleanupPolling();
    this.cleanupInactivityTimer();
    this.mode = "disconnected";
    this.onReceiveCallback = null;
  }

  // Private methods

  private async connectSSE(): Promise<void> {
    this.cleanupPolling();

    try {
      const url = `${this.baseUrl}/events?docId=${this.docId}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "timeout" && data.suggestPolling) {
            console.log("SSE timeout, switching to polling...");
            this.switchToPolling();
            return;
          }

          if (data.revision !== undefined) {
            this.currentRevision = data.revision;
          }

          this.onReceiveCallback?.(data as M);
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error("SSE error:", error);

        // Try to reconnect
        this.reconnectAttempts++;

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            console.log(
              `Reconnecting SSE (attempt ${this.reconnectAttempts})...`
            );
            this.connectSSE();
          }, this.reconnectDelay * this.reconnectAttempts);
        } else {
          console.log("Max reconnect attempts reached, switching to polling");
          this.switchToPolling();
        }
      };

      this.eventSource.onopen = () => {
        console.log("SSE connected");
        this.mode = "sse";
        this.reconnectAttempts = 0; // Reset on successful connection
      };
    } catch (error) {
      console.error("Failed to connect SSE:", error);
      this.switchToPolling();
    }
  }

  private switchToPolling(): void {
    this.cleanupSSE();
    this.mode = "polling";
    console.log("Switched to polling mode");

    this.startPolling();
  }

  private startPolling(): void {
    this.cleanupPolling();

    const poll = async () => {
      try {
        const url = `${this.baseUrl}/poll?docId=${this.docId}&since=${this.currentRevision}`;
        const response = await fetch(url, {
          headers: this.headers,
        });

        if (!response.ok) {
          console.error("Polling failed:", response.status);
          return;
        }

        const data = await response.json();

        if (data.hasUpdates && data.operations) {
          for (const op of data.operations) {
            this.currentRevision = op.revision;
            this.onReceiveCallback?.({
              type: "op",
              op: op.op,
              revision: op.revision,
            } as unknown as M);
          }
        }

        if (data.revision !== undefined) {
          this.currentRevision = data.revision;
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    // Poll immediately, then on interval
    poll();
    this.pollingTimer = setInterval(poll, this.pollingInterval);
  }

  private markActivity(): void {
    this.lastActivityTime = Date.now();

    // If we're polling and user is active, switch back to SSE
    if (this.mode === "polling") {
      console.log("Activity detected, switching back to SSE...");
      this.connectSSE();
    }

    this.resetInactivityTimer();
  }

  private resetInactivityTimer(): void {
    this.cleanupInactivityTimer();

    this.inactivityTimer = setTimeout(() => {
      const inactiveTime = Date.now() - this.lastActivityTime;

      if (inactiveTime >= this.inactivityTimeout && this.mode === "sse") {
        console.log("User inactive, switching to polling to save costs...");
        this.switchToPolling();
      }
    }, this.inactivityTimeout);
  }

  private cleanupSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private cleanupPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private cleanupInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }

  // Public methods for manual mode switching

  public getCurrentMode(): ConnectionMode {
    return this.mode;
  }

  public async forceSSE(): Promise<void> {
    if (this.mode !== "sse") {
      await this.connectSSE();
    }
  }

  public forcePolling(): void {
    if (this.mode !== "polling") {
      this.switchToPolling();
    }
  }
}
