/* ──────────────────────────────────────────────
   Model Orchestrator — dispatch prompts to
   multiple models, run consensus pipeline.
   ────────────────────────────────────────────── */

import {
    ModelName,
    ModelResponse,
    ConsensusResult,
    OrchestratorConfig,
    DEFAULT_CONFIG,
} from './types';
import { runConsensus } from './consensus';

/**
 * Controller interface — each automation model must implement this.
 */
export interface ModelController {
    readonly name: ModelName;
    ask(prompt: string): Promise<ModelResponse>;
    isReady(): boolean;
}

/**
 * Orchestrator manages multiple model controllers and runs
 * the consensus pipeline.
 */
export class Orchestrator {
    private controllers: Map<ModelName, ModelController> = new Map();
    private config: OrchestratorConfig;

    constructor(config: Partial<OrchestratorConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Register a model controller */
    registerController(controller: ModelController): void {
        this.controllers.set(controller.name, controller);
        console.log(`[Orchestrator] Registered model: ${controller.name}`);
    }

    /** Unregister a model */
    removeController(name: ModelName): void {
        this.controllers.delete(name);
    }

    /** Get list of registered model names */
    getRegisteredModels(): ModelName[] {
        return Array.from(this.controllers.keys());
    }

    /**
     * Run the full consensus pipeline:
     *
     * 1. Dispatch prompt to all enabled models in parallel
     * 2. Collect responses (with timeout + graceful failure)
     * 3. Run consensus scoring + merge
     * 4. Return final result
     */
    async run(
        prompt: string,
        enabledModels?: ModelName[],
        currentFile: string = 'unknown',
        selectionRange?: { startLine: number; startChar: number; endLine: number; endChar: number }
    ): Promise<ConsensusResult> {
        // Determine which models to use
        const modelsToUse = this.resolveModels(enabledModels);

        if (modelsToUse.length === 0) {
            throw new Error('No models available. Register at least one controller.');
        }

        console.log(`[Orchestrator] Dispatching to ${modelsToUse.length} models: ${modelsToUse.join(', ')}`);

        // ── Step 1: Proposal round ──
        const responses = await this.dispatchParallel(prompt, modelsToUse);

        if (responses.length === 0) {
            throw new Error('All models failed to respond.');
        }

        console.log(`[Orchestrator] Received ${responses.length}/${modelsToUse.length} responses`);

        // ── Step 2: Critique round (optional) ──
        if (this.config.enableCritique && responses.length > 1) {
            await this.runCritiqueRound(responses);
        }

        // ── Step 3 & 4: Score + Merge ──
        const consensus = runConsensus(responses, currentFile, selectionRange);

        console.log(`[Orchestrator] Consensus: winner=${consensus.winnerModel}, ` +
            `strategy=${consensus.mergeStrategy}, score=${consensus.consensusScore.toFixed(2)}`);

        return consensus;
    }

    /**
     * Dispatch prompt to multiple models concurrently.
     * Each model has its own timeout. Failed models are logged but skipped.
     */
    private async dispatchParallel(
        prompt: string,
        models: ModelName[]
    ): Promise<ModelResponse[]> {
        const promises = models.map((modelName) =>
            this.askWithTimeout(modelName, prompt)
        );

        const results = await Promise.allSettled(promises);
        const responses: ModelResponse[] = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'fulfilled' && result.value) {
                responses.push(result.value);
            } else {
                const reason = result.status === 'rejected' ? result.reason : 'null response';
                console.warn(`[Orchestrator] Model ${models[i]} failed: ${reason}`);
            }
        }

        return responses;
    }

    /**
     * Ask a single model with a timeout wrapper.
     */
    private async askWithTimeout(
        modelName: ModelName,
        prompt: string
    ): Promise<ModelResponse | null> {
        const controller = this.controllers.get(modelName);
        if (!controller) {
            console.warn(`[Orchestrator] No controller for ${modelName}`);
            return null;
        }

        if (!controller.isReady()) {
            console.warn(`[Orchestrator] ${modelName} not ready, skipping`);
            return null;
        }

        const start = Date.now();

        return Promise.race([
            controller.ask(prompt).then((response) => {
                response.latencyMs = Date.now() - start;
                return response;
            }),
            new Promise<null>((resolve) =>
                setTimeout(() => {
                    console.warn(`[Orchestrator] ${modelName} timed out after ${this.config.modelTimeoutMs}ms`);
                    resolve(null);
                }, this.config.modelTimeoutMs)
            ),
        ]);
    }

    /**
     * Critique round — each model reviews other proposals.
     * Updates confidence based on peer review.
     *
     * NOTE: For the initial implementation, critiques adjust confidence
     * scores heuristically. A full implementation would send critique
     * prompts back through the models.
     */
    private async runCritiqueRound(responses: ModelResponse[]): Promise<void> {
        console.log(`[Orchestrator] Running critique round with ${responses.length} proposals`);

        // Cross-validate: models with code blocks get a confidence boost
        // Models that agree on approach get boosted further
        const codeSignatures = responses.map((r) => {
            const combined = r.codeBlocks.map((b) => b.code).join('\n');
            return {
                model: r.model,
                hasCode: r.codeBlocks.length > 0,
                length: combined.length,
                keywords: extractKeywords(combined),
            };
        });

        // Find consensus patterns
        for (const response of responses) {
            const mySignature = codeSignatures.find((s) => s.model === response.model)!;
            let agreementCount = 0;

            for (const other of codeSignatures) {
                if (other.model === response.model) continue;
                // Check keyword overlap
                const overlap = mySignature.keywords.filter((k) => other.keywords.includes(k)).length;
                if (overlap > mySignature.keywords.length * 0.3) {
                    agreementCount++;
                }
            }

            // Boost confidence for models that agree with others
            const agreementRatio = agreementCount / (codeSignatures.length - 1);
            response.confidence = Math.min(1, response.confidence + agreementRatio * 0.15);
        }
    }

    /**
     * Resolve which models to actually use.
     */
    private resolveModels(enabledModels?: ModelName[]): ModelName[] {
        const registered = Array.from(this.controllers.keys());

        if (enabledModels && enabledModels.length > 0) {
            return enabledModels.filter((m) => registered.includes(m));
        }

        return registered;
    }
}

/**
 * Extract simple keywords from code for similarity comparison.
 */
function extractKeywords(code: string): string[] {
    return code
        .replace(/[^a-zA-Z0-9_]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 50);
}
