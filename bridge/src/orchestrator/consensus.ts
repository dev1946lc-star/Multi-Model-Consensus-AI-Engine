/* ──────────────────────────────────────────────
   Consensus Engine — score and merge proposals
   from multiple AI models.
   ────────────────────────────────────────────── */

import {
    ModelResponse,
    ModelName,
    ConsensusResult,
    ScoreBreakdown,
    MergeStrategy,
} from './types';
import { extractCodeBlocks, extractExplanation } from '../response-parser';
import { buildEdits } from '../patch-engine';

/** Scoring weights (must sum to 1.0) */
const WEIGHTS = {
    correctness: 0.30,
    completeness: 0.25,
    safety: 0.20,
    style: 0.15,
    performance: 0.10,
};

/**
 * Run the consensus pipeline on collected model responses.
 *
 * 1. Score each proposal
 * 2. Determine merge strategy
 * 3. Build final edits
 */
export function runConsensus(
    responses: ModelResponse[],
    currentFile: string,
    selectionRange?: { startLine: number; startChar: number; endLine: number; endChar: number }
): ConsensusResult {
    if (responses.length === 0) {
        throw new Error('No model responses to evaluate');
    }

    // If only one response, it wins by default
    if (responses.length === 1) {
        const sole = responses[0];
        const score = scoreProposal(sole);
        const edits = buildEdits(sole.codeBlocks, currentFile, selectionRange);
        return {
            winnerModel: sole.model,
            mergeStrategy: 'clear_winner',
            scores: { [sole.model]: score } as Record<ModelName, ScoreBreakdown>,
            finalProposal: sole.proposal,
            edits,
            modelsUsed: [sole.model],
            consensusScore: normalizeTotal(score.total),
            confidence: sole.confidence,
        };
    }

    // Score all proposals
    const scores: Record<string, ScoreBreakdown> = {};
    for (const r of responses) {
        scores[r.model] = scoreProposal(r);
    }

    // Sort by total score descending
    const ranked = [...responses].sort(
        (a, b) => scores[b.model].total - scores[a.model].total
    );

    // Determine merge strategy
    const topScore = scores[ranked[0].model].total;
    const secondScore = scores[ranked[1].model].total;
    const gap = topScore - secondScore;

    let mergeStrategy: MergeStrategy;
    let finalProposal: string;
    let winnerModel: ModelName;

    if (gap > 1.5) {
        // Clear winner
        mergeStrategy = 'clear_winner';
        finalProposal = ranked[0].proposal;
        winnerModel = ranked[0].model;
    } else if (gap <= 1.5 && gap >= 0) {
        // Close scores — merge the top two
        mergeStrategy = 'merged';
        finalProposal = mergeProposals(ranked[0], ranked[1]);
        winnerModel = ranked[0].model;
    } else {
        // Conflict — use judge fallback (ChatGPT or first model)
        mergeStrategy = 'judge_fallback';
        const judge = ranked.find((r) => r.model === 'chatgpt') || ranked[0];
        finalProposal = judge.proposal;
        winnerModel = judge.model;
    }

    // Build edits from the winning/merged proposal
    const finalBlocks = extractCodeBlocks(finalProposal);
    const edits = buildEdits(
        finalBlocks.length > 0 ? finalBlocks : ranked[0].codeBlocks,
        currentFile,
        selectionRange
    );

    // Consensus score = average of the top half of models
    const topHalf = ranked.slice(0, Math.ceil(ranked.length / 2));
    const avgScore = topHalf.reduce((s, r) => s + scores[r.model].total, 0) / topHalf.length;

    return {
        winnerModel,
        mergeStrategy,
        scores: scores as Record<ModelName, ScoreBreakdown>,
        finalProposal,
        edits,
        modelsUsed: responses.map((r) => r.model),
        consensusScore: normalizeTotal(avgScore),
        confidence: ranked[0].confidence,
    };
}

/**
 * Score a single model's proposal based on heuristics.
 *
 * NOTE: These are heuristic scores. In the critique round,
 * other models would provide evaluations that could override these.
 */
function scoreProposal(response: ModelResponse): ScoreBreakdown {
    const { proposal, codeBlocks, confidence } = response;

    // Correctness: code blocks present + confidence
    const correctness = Math.min(10,
        (codeBlocks.length > 0 ? 5 : 0) +
        (confidence * 5)
    );

    // Completeness: has explanation + code + reasonable length
    const hasExplanation = (proposal.length - codeBlocks.reduce((s, b) => s + b.code.length, 0)) > 50;
    const completeness = Math.min(10,
        (codeBlocks.length > 0 ? 4 : 0) +
        (hasExplanation ? 3 : 0) +
        Math.min(3, proposal.length / 500)
    );

    // Safety: no dangerous patterns
    const dangerPatterns = [
        /rm\s+-rf/i,
        /eval\s*\(/,
        /exec\s*\(/,
        /process\.exit/,
        /DROP\s+TABLE/i,
        /DELETE\s+FROM/i,
    ];
    const dangerCount = dangerPatterns.filter((p) =>
        codeBlocks.some((b) => p.test(b.code))
    ).length;
    const safety = Math.max(0, 10 - dangerCount * 3);

    // Style: consistent formatting, comments
    const hasComments = codeBlocks.some((b) =>
        b.code.includes('//') || b.code.includes('/*') || b.code.includes('#')
    );
    const style = Math.min(10,
        (hasComments ? 4 : 2) +
        (codeBlocks.length > 0 ? 3 : 0) +
        Math.min(3, confidence * 3)
    );

    // Performance: concise solutions score higher
    const totalCodeLength = codeBlocks.reduce((s, b) => s + b.code.length, 0);
    const perf = Math.min(10,
        totalCodeLength > 0 ? Math.max(3, 10 - Math.floor(totalCodeLength / 2000)) : 5
    );

    const total =
        correctness * WEIGHTS.correctness +
        completeness * WEIGHTS.completeness +
        safety * WEIGHTS.safety +
        style * WEIGHTS.style +
        perf * WEIGHTS.performance;

    return { correctness, completeness, safety, style, performance: perf, total };
}

/**
 * Merge two similar proposals by preferring the one with more code blocks
 * and richer explanation.
 */
function mergeProposals(primary: ModelResponse, secondary: ModelResponse): string {
    // Use primary's code but supplement with secondary's explanation if richer
    const primaryExplanation = extractExplanation(primary.proposal);
    const secondaryExplanation = extractExplanation(secondary.proposal);

    let merged = primary.proposal;

    // If secondary has a noticeably richer explanation, append insights
    if (secondaryExplanation.length > primaryExplanation.length * 1.5) {
        merged += `\n\n<!-- Additional insights from ${secondary.model} -->\n${secondaryExplanation}`;
    }

    return merged;
}

/**
 * Normalize a weighted total score to 0–1 range.
 */
function normalizeTotal(total: number): number {
    return Math.min(1, Math.max(0, total / 10));
}
