/* ──────────────────────────────────────────────
   Orchestrator Types — model response and
   consensus result interfaces.
   ────────────────────────────────────────────── */

export { ModelResponse, ModelName, ConsensusResult, ScoreBreakdown, MergeStrategy, CodeBlock } from '../message-types';

/** Configuration for the orchestrator */
export interface OrchestratorConfig {
    /** Timeout per model in ms (default: 120000) */
    modelTimeoutMs: number;
    /** Max models to run in parallel */
    maxParallel: number;
    /** Whether to run the critique round */
    enableCritique: boolean;
    /** Minimum number of models that must respond */
    minResponses: number;
}

export const DEFAULT_CONFIG: OrchestratorConfig = {
    modelTimeoutMs: 120_000,
    maxParallel: 6,
    enableCritique: true,
    minResponses: 1,
};

/** Critique from one model about another's proposal */
export interface Critique {
    reviewer: string;
    targetModel: string;
    feedback: string;
    suggestedScore: number;
}
