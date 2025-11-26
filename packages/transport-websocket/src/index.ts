import { TransportAdapter } from "@open-ot/core";
import WebSocket from "ws";

export class WebSocketTransport<M = unknown> implements TransportAdapter<M> {
  private socket: WebSocket | null = null;
  private url: string;
  private onReceiveCallback: ((msg: M) => void) | null = null;
  private isConnected: boolean = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(onReceive: (msg: M) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        // Already connected or connecting
        if (this.socket.readyState === WebSocket.OPEN) {
          this.onReceiveCallback = onReceive;
          resolve();
          return;
        }
      }

      this.onReceiveCallback = onReceive;
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.isConnected = true;
        resolve();
      };

      this.socket.onerror = (err) => {
        if (!this.isConnected) {
          reject(err);
        }
        // If already connected, we might want to handle error differently,
        // but for now we just log or ignore as 'close' will likely follow.
      };

      this.socket.onmessage = (event) => {
        if (this.onReceiveCallback) {
          try {
            const data = JSON.parse(event.data as string);
            this.onReceiveCallback(data as M);
          } catch (e) {
            // Failed to parse, ignore error.
          }
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.socket = null;
      };
    });
  }

  async send(msg: M): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Transport disconnected");
    }

    const data = JSON.stringify(msg);
    this.socket.send(data);
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.onReceiveCallback = null;
  }
}
