/* ──────────────────────────────────────────────
   Bridge WebSocket Server
   Port 3210 — localhost only
   ────────────────────────────────────────────── */

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import {
    BridgeRequest,
    BridgeResponse,
    ALL_MODELS,
} from './message-types';
import { extractCodeBlocks, extractExplanation } from './response-parser';
import { buildEdits } from './patch-engine';
import { Orchestrator } from './orchestrator/orchestrator';

const PORT = 3210;

/** Initialize the orchestrator */
const orchestrator = new Orchestrator({
    modelTimeoutMs: 120_000,
    enableCritique: true,
    minResponses: 1,
});

/**
 * NOTE: In production, you would register actual model controllers here.
 * See /automation/src/controllers/ for implementations.
 *
 * Example:
 *   import { ChatGPTController } from '../../automation/src/controllers/chatgpt';
 *   orchestrator.registerController(new ChatGPTController());
 */

/** Start the WebSocket server */
function startServer(): void {
    const wss = new WebSocketServer({
        port: PORT,
        host: '127.0.0.1', // localhost only — security
    });

    console.log(`\n🤖 Copilot Bridge Server`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Host: 127.0.0.1 (localhost only)`);
    console.log(`   Models registered: ${orchestrator.getRegisteredModels().join(', ') || 'none'}\n`);

    wss.on('connection', (ws: WebSocket) => {
        const clientId = uuid().slice(0, 8);
        console.log(`[Server] Client connected: ${clientId}`);

        ws.on('message', async (data: Buffer) => {
            let request: BridgeRequest;

            try {
                request = JSON.parse(data.toString());
            } catch {
                sendError(ws, 'unknown', 'Invalid JSON message');
                return;
            }

            console.log(`[Server] Received ${request.type} (id: ${request.id})`);

            try {
                const response = await handleRequest(request);
                ws.send(JSON.stringify(response));
            } catch (err: any) {
                console.error(`[Server] Error handling ${request.type}:`, err.message);
                sendError(ws, request.id, err.message);
            }
        });

        ws.on('close', () => {
            console.log(`[Server] Client disconnected: ${clientId}`);
        });

        ws.on('error', (err) => {
            console.error(`[Server] WebSocket error (${clientId}):`, err.message);
        });
    });

    wss.on('error', (err) => {
        console.error('[Server] Server error:', err.message);
        process.exit(1);
    });
}

/**
 * Route an incoming request to the appropriate handler.
 */
async function handleRequest(request: BridgeRequest): Promise<BridgeResponse> {
    switch (request.type) {
        case 'ping':
            return {
                id: request.id,
                success: true,
                explanation: 'pong',
            };

        case 'ask':
        case 'edit':
        case 'create':
            return handleAIRequest(request);

        default:
            return {
                id: request.id,
                success: false,
                error: `Unknown request type: ${request.type}`,
            };
    }
}

/**
 * Handle AI coding requests through the orchestrator.
 */
async function handleAIRequest(request: BridgeRequest): Promise<BridgeResponse> {
    const prompt = buildPrompt(request);
    const enabledModels = request.enabledModels || ALL_MODELS;
    const currentFile = request.filename || request.context?.currentFile || 'unknown';
    const selectionRange = request.context?.selectionRange;

    // Check if any models are registered
    const registeredModels = orchestrator.getRegisteredModels();

    if (registeredModels.length === 0) {
        // Fallback: return a helpful message when no models are connected
        return {
            id: request.id,
            success: false,
            error: 'No AI models are connected. Start the automation controllers first.\n'
                + 'Run: cd automation && npm run start -- --model chatgpt',
        };
    }

    try {
        const result = await orchestrator.run(
            prompt,
            enabledModels,
            currentFile,
            selectionRange
        );

        return {
            id: request.id,
            success: true,
            edits: result.edits,
            explanation: extractExplanation(result.finalProposal),
            consensus: {
                modelsUsed: result.modelsUsed,
                winnerModel: result.winnerModel,
                consensusScore: result.consensusScore,
                confidence: result.confidence,
                mergeStrategy: result.mergeStrategy,
                scores: result.scores,
            },
        };
    } catch (err: any) {
        return {
            id: request.id,
            success: false,
            error: `Orchestrator error: ${err.message}`,
        };
    }
}

/**
 * Build a formatted prompt from the request.
 */
function buildPrompt(request: BridgeRequest): string {
    const parts: string[] = [];

    parts.push('You are an AI coding assistant integrated into VS Code.');
    parts.push('Always respond with either:');
    parts.push('1. An explanation');
    parts.push('2. A unified diff (```diff)');
    parts.push('3. Full file content in a fenced code block');
    parts.push('');

    if (request.instruction) {
        parts.push(`INSTRUCTION:\n${request.instruction}`);
        parts.push('');
    }

    if (request.filename) {
        parts.push(`FILE:\n${request.filename}`);
        parts.push('');
    }

    if (request.code) {
        parts.push(`CODE:\n\`\`\`\n${request.code}\n\`\`\``);
        parts.push('');
    }

    if (request.context) {
        const ctx = request.context;
        if (ctx.selectedText) {
            parts.push(`SELECTED TEXT:\n\`\`\`\n${ctx.selectedText}\n\`\`\``);
            parts.push('');
        }
        if (ctx.openFiles && ctx.openFiles.length > 0) {
            parts.push(`OPEN FILES:\n${ctx.openFiles.join('\n')}`);
            parts.push('');
        }
        if (ctx.projectTree) {
            parts.push(`PROJECT TREE:\n${ctx.projectTree}`);
        }
    }

    return parts.join('\n');
}

/**
 * Send an error response.
 */
function sendError(ws: WebSocket, id: string, message: string): void {
    const response: BridgeResponse = {
        id,
        success: false,
        error: message,
    };
    ws.send(JSON.stringify(response));
}

// ── Launch ──
startServer();
