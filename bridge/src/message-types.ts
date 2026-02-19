/* ──────────────────────────────────────────────
   Shared interfaces for bridge communication
   ────────────────────────────────────────────── */

/** Request types sent from the VS Code extension */
export type RequestType = 'ask' | 'edit' | 'create' | 'ping';

/** Incoming message from VS Code */
export interface BridgeRequest {
    id: string;
    type: RequestType;
    instruction: string;
    code?: string;
    filename?: string;
    context?: ProjectContext;
    /** Which models the user has enabled */
    enabledModels?: ModelName[];
}

/** Project context collected by the extension */
export interface ProjectContext {
    currentFile: string;
    currentFileContent: string;
    selectedText?: string;
    selectionRange?: SelectionRange;
    openFiles: string[];
    projectTree?: string;
}

export interface SelectionRange {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
}

/** Supported model names */
export type ModelName = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'qwen' | 'kimi';

export const ALL_MODELS: ModelName[] = ['chatgpt', 'claude', 'gemini', 'deepseek', 'qwen', 'kimi'];

/** A single code edit to apply in VS Code */
export interface Edit {
    file: string;
    range?: {
        startLine: number;
        startChar: number;
        endLine: number;
        endChar: number;
    };
    newText: string;
    /** 'replace' = patch range, 'create' = new file, 'full' = replace entire file */
    action: 'replace' | 'create' | 'full';
}

/** Response from a single model */
export interface ModelResponse {
    model: ModelName;
    proposal: string;
    codeBlocks: CodeBlock[];
    confidence: number;          // 0–1
    error?: string;
    latencyMs: number;
}

export interface CodeBlock {
    language: string;
    code: string;
    filename?: string;
    isDiff: boolean;
}

/** Score breakdown for a model's proposal */
export interface ScoreBreakdown {
    correctness: number;         // 0–10
    completeness: number;        // 0–10
    safety: number;              // 0–10
    style: number;               // 0–10
    performance: number;         // 0–10
    total: number;               // weighted sum
}

/** Result of the consensus pipeline */
export interface ConsensusResult {
    winnerModel: ModelName;
    mergeStrategy: MergeStrategy;
    scores: Record<ModelName, ScoreBreakdown>;
    finalProposal: string;
    edits: Edit[];
    modelsUsed: ModelName[];
    consensusScore: number;      // 0–1
    confidence: number;          // 0–1
}

export type MergeStrategy = 'clear_winner' | 'merged' | 'judge_fallback';

/** Final response sent back to VS Code */
export interface BridgeResponse {
    id: string;
    success: boolean;
    edits?: Edit[];
    explanation?: string;
    consensus?: {
        modelsUsed: ModelName[];
        winnerModel: ModelName;
        consensusScore: number;
        confidence: number;
        mergeStrategy: MergeStrategy;
        scores: Record<string, ScoreBreakdown>;
    };
    error?: string;
}
