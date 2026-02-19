/* ──────────────────────────────────────────────
   Chat Panel — Webview sidebar for the
   multi-model AI copilot.
   ────────────────────────────────────────────── */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Webview provider for the sidebar chat panel.
 * Shows chat history, action buttons, and consensus info.
 */
export class ChatPanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'copilot.chatPanel';

    private view?: vscode.WebviewView;
    private extensionUri: vscode.Uri;

    /** Callback for when the user sends a message from the webview */
    public onUserMessage?: (message: { type: string; instruction: string }) => void;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, 'media'),
            ],
        };

        webviewView.webview.html = this.getHtml(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage((message) => {
            if (this.onUserMessage) {
                this.onUserMessage(message);
            }
        });
    }

    /** Send a message to the webview */
    postMessage(message: any): void {
        this.view?.webview.postMessage(message);
    }

    /** Add a chat message to the panel */
    addMessage(role: 'user' | 'assistant', content: string, consensus?: any): void {
        this.postMessage({
            type: 'addMessage',
            role,
            content,
            consensus,
        });
    }

    /** Show loading state */
    setLoading(loading: boolean): void {
        this.postMessage({ type: 'setLoading', loading });
    }

    /** Generate the webview HTML */
    private getHtml(webview: vscode.Webview): string {
        const cssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.css')
        );
        const jsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.js')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link href="${cssUri}" rel="stylesheet">
  <title>AI Copilot</title>
</head>
<body>
  <div id="app">
    <div id="header">
      <h2>🤖 Multi-Model AI</h2>
      <div id="connection-status" class="status disconnected">Disconnected</div>
    </div>

    <div id="actions">
      <button data-action="ask" title="Ask about current file">💬 Ask</button>
      <button data-action="fix" title="Fix selected code">🔧 Fix</button>
      <button data-action="explain" title="Explain selected code">📖 Explain</button>
      <button data-action="refactor" title="Refactor selected code">♻️ Refactor</button>
      <button data-action="create" title="Create a new file">📄 Create</button>
    </div>

    <div id="messages"></div>

    <div id="loading" class="hidden">
      <div class="spinner"></div>
      <span>Models are thinking...</span>
    </div>

    <div id="input-area">
      <textarea id="user-input" placeholder="Describe what you want..." rows="3"></textarea>
      <button id="send-btn" title="Send">▶</button>
    </div>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
    }
}

/** Generate a random nonce for CSP */
function getNonce(): string {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
