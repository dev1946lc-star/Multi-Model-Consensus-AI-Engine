/* ──────────────────────────────────────────────
   Extension Entry Point — register commands,
   wire up bridge client and chat panel.
   ────────────────────────────────────────────── */

import * as vscode from 'vscode';
import { BridgeClient } from './bridge-client';
import { collectContext } from './context-collector';
import { applyEdits, Edit } from './patch-applier';
import { ChatPanelProvider } from './chat-panel';

let bridgeClient: BridgeClient;
let chatPanel: ChatPanelProvider;
let requestCounter = 0;

/** Generate a unique request ID */
function nextId(): string {
    return `req_${Date.now()}_${++requestCounter}`;
}

/**
 * Extension activation.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('[Copilot] Activating Multi-Model AI Copilot');

    // Read settings
    const config = vscode.workspace.getConfiguration('copilot');
    const port = config.get<number>('bridgePort', 3210);

    // Initialize bridge client
    bridgeClient = new BridgeClient(port);
    bridgeClient.connect();

    // Initialize chat panel
    chatPanel = new ChatPanelProvider(context.extensionUri);

    // Register the webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            ChatPanelProvider.viewType,
            chatPanel
        )
    );

    // Handle messages from the chat panel webview
    chatPanel.onUserMessage = async (msg) => {
        if (msg.type === 'ask' || msg.type === 'fix' || msg.type === 'explain' ||
            msg.type === 'refactor' || msg.type === 'create') {
            await handleAIRequest(msg.type as any, msg.instruction);
        }
    };

    // ── Register Commands ──

    context.subscriptions.push(
        vscode.commands.registerCommand('copilot.askChatGPT', async () => {
            const instruction = await vscode.window.showInputBox({
                prompt: 'What do you want to ask the AI?',
                placeHolder: 'e.g., Optimize this function for performance',
            });
            if (instruction) {
                await handleAIRequest('ask', instruction);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('copilot.fixWithAI', async () => {
            await handleAIRequest('edit', 'Fix the bugs in this code. Explain what was wrong.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('copilot.explainCode', async () => {
            await handleAIRequest('ask', 'Explain this code in detail. What does it do and how?');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('copilot.refactorCode', async () => {
            await handleAIRequest('edit', 'Refactor this code for better readability, performance, and maintainability.');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('copilot.createFile', async () => {
            const instruction = await vscode.window.showInputBox({
                prompt: 'Describe the file to create',
                placeHolder: 'e.g., Create a React component for user authentication',
            });
            if (instruction) {
                await handleAIRequest('create', instruction);
            }
        })
    );

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = '$(hubot) AI Copilot';
    statusBarItem.tooltip = 'Multi-Model AI Copilot';
    statusBarItem.command = 'copilot.askChatGPT';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    console.log('[Copilot] Activated successfully');
}

/**
 * Handle an AI request — collect context, send to bridge, apply results.
 */
async function handleAIRequest(
    type: 'ask' | 'edit' | 'create',
    instruction: string
): Promise<void> {
    const ctx = collectContext();
    const config = vscode.workspace.getConfiguration('copilot');
    const enabledModels = config.get<string[]>('enabledModels', ['chatgpt']);

    // Show in chat panel
    chatPanel.addMessage('user', instruction);
    chatPanel.setLoading(true);

    const request = {
        id: nextId(),
        type,
        instruction,
        code: ctx.selectedText || ctx.currentFileContent,
        filename: ctx.currentFile,
        context: ctx,
        enabledModels,
    };

    try {
        vscode.window.setStatusBarMessage('$(sync~spin) AI is thinking...', 120_000);

        const response = await bridgeClient.request(request);

        chatPanel.setLoading(false);

        if (!response.success) {
            const errorMsg = response.error || 'Unknown error';
            chatPanel.addMessage('assistant', `❌ Error: ${errorMsg}`);
            vscode.window.showErrorMessage(`AI Error: ${errorMsg}`);
            return;
        }

        // Show explanation in chat panel
        if (response.explanation) {
            chatPanel.addMessage('assistant', response.explanation, response.consensus);
        }

        // Apply edits if present
        if (response.edits && response.edits.length > 0) {
            const choice = await vscode.window.showInformationMessage(
                `AI suggests ${response.edits.length} edit(s). ${response.consensus
                    ? `Winner: ${response.consensus.winnerModel} (${Math.round(response.consensus.consensusScore * 100)}% consensus)`
                    : ''
                }`,
                'Preview & Apply',
                'Skip'
            );

            if (choice === 'Preview & Apply') {
                await applyEdits(response.edits as Edit[]);
            }
        }

        vscode.window.setStatusBarMessage('$(check) AI done', 3000);
    } catch (err: any) {
        chatPanel.setLoading(false);
        chatPanel.addMessage('assistant', `❌ ${err.message}`);
        vscode.window.showErrorMessage(`AI Copilot: ${err.message}`);
    }
}

/**
 * Extension deactivation.
 */
export function deactivate() {
    bridgeClient?.disconnect();
    console.log('[Copilot] Deactivated');
}
