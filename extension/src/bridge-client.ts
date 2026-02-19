/* ──────────────────────────────────────────────
   Bridge Client — WebSocket connection to the
   bridge server with auto-reconnect.
   ────────────────────────────────────────────── */

import * as vscode from 'vscode';
import WebSocket from 'ws';

interface PendingRequest {
    resolve: (data: any) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
}

/**
 * Manages the WebSocket connection to the local bridge server.
 * Provides promise-based request/response with timeout and auto-reconnect.
 */
export class BridgeClient {
    private ws: WebSocket | null = null;
    private pending: Map<string, PendingRequest> = new Map();
    private reconnectTimer: NodeJS.Timeout | null = null;
    private connected = false;
    private port: number;
    private requestTimeout: number;

    constructor(port = 3210, requestTimeout = 180_000) {
        this.port = port;
        this.requestTimeout = requestTimeout;
    }

    /** Connect to the bridge server */
    connect(): void {
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
        }

        const url = `ws://127.0.0.1:${this.port}`;
        console.log(`[BridgeClient] Connecting to ${url}`);

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            this.connected = true;
            console.log('[BridgeClient] Connected');
            vscode.window.setStatusBarMessage('$(check) AI Bridge Connected', 3000);
        });

        this.ws.on('message', (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString());
                const pending = this.pending.get(msg.id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    this.pending.delete(msg.id);
                    pending.resolve(msg);
                }
            } catch (err) {
                console.error('[BridgeClient] Failed to parse message:', err);
            }
        });

        this.ws.on('close', () => {
            this.connected = false;
            console.log('[BridgeClient] Disconnected');
            this.scheduleReconnect();
        });

        this.ws.on('error', (err) => {
            console.error('[BridgeClient] Error:', err.message);
            this.connected = false;
        });
    }

    /** Send a request and wait for the response */
    async request(message: any): Promise<any> {
        if (!this.ws || !this.connected) {
            this.connect();
            // Wait briefly for connection
            await new Promise((r) => setTimeout(r, 1000));
            if (!this.connected) {
                throw new Error('Bridge server not available. Run: npm run start-bridge');
            }
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(message.id);
                reject(new Error(`Request timed out after ${this.requestTimeout / 1000}s`));
            }, this.requestTimeout);

            this.pending.set(message.id, { resolve, reject, timeout });

            this.ws!.send(JSON.stringify(message));
        });
    }

    /** Check if connected */
    isConnected(): boolean {
        return this.connected;
    }

    /** Disconnect cleanly */
    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;

        // Reject all pending requests
        for (const [id, pending] of this.pending) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Client disconnected'));
        }
        this.pending.clear();
    }

    /** Auto-reconnect after disconnect */
    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            console.log('[BridgeClient] Attempting reconnect...');
            this.connect();
        }, 5000);
    }
}
