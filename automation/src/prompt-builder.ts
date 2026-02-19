/* ──────────────────────────────────────────────
   Prompt Builder — construct formatted prompts
   for proposal, critique, and judge rounds.
   ────────────────────────────────────────────── */

/** Max characters before truncation */
const MAX_CODE_LENGTH = 12_000;
const MAX_CONTEXT_LENGTH = 4_000;

export interface PromptInput {
    instruction: string;
    filename?: string;
    code?: string;
    selectedText?: string;
    projectTree?: string;
    openFiles?: string[];
}

/**
 * Build a proposal prompt for the initial coding task.
 */
export function buildProposalPrompt(input: PromptInput): string {
    const parts: string[] = [];

    parts.push('You are one of several AI coding experts collaborating on a task.');
    parts.push('Produce your best solution. Use fenced code blocks.');
    parts.push('Respond with either: an explanation, a unified diff, or full file content.');
    parts.push('');

    if (input.instruction) {
        parts.push(`INSTRUCTION:\n${input.instruction}`);
        parts.push('');
    }

    if (input.filename) {
        parts.push(`FILE: ${input.filename}`);
        parts.push('');
    }

    if (input.code) {
        parts.push(`CODE:\n\`\`\`\n${truncate(input.code, MAX_CODE_LENGTH)}\n\`\`\``);
        parts.push('');
    }

    if (input.selectedText) {
        parts.push(`SELECTED TEXT:\n\`\`\`\n${truncate(input.selectedText, MAX_CODE_LENGTH)}\n\`\`\``);
        parts.push('');
    }

    if (input.openFiles && input.openFiles.length > 0) {
        parts.push(`OPEN FILES:\n${input.openFiles.slice(0, 20).join('\n')}`);
        parts.push('');
    }

    if (input.projectTree) {
        parts.push(`PROJECT:\n${truncate(input.projectTree, MAX_CONTEXT_LENGTH)}`);
    }

    return parts.join('\n');
}

/**
 * Build a critique prompt — asks a model to review another's proposal.
 */
export function buildCritiquePrompt(
    originalInstruction: string,
    proposalModel: string,
    proposal: string
): string {
    return [
        'You are reviewing another AI\'s code solution. Find flaws, bugs, and improvements.',
        '',
        `ORIGINAL TASK:\n${originalInstruction}`,
        '',
        `PROPOSAL BY ${proposalModel.toUpperCase()}:`,
        proposal,
        '',
        'Provide:',
        '1. Bugs or correctness issues',
        '2. Missing edge cases',
        '3. Style/readability concerns',
        '4. Suggested improvements',
        '5. Score 1-10 for overall quality',
    ].join('\n');
}

/**
 * Build a judge prompt — asks a model to merge the best aspects.
 */
export function buildJudgePrompt(
    instruction: string,
    proposals: Array<{ model: string; proposal: string }>
): string {
    const parts: string[] = [];

    parts.push('You are the final judge. Merge the best aspects of these solutions into one optimal result.');
    parts.push('Use fenced code blocks for your final answer.');
    parts.push('');
    parts.push(`TASK:\n${instruction}`);
    parts.push('');

    for (const { model, proposal } of proposals) {
        parts.push(`──── ${model.toUpperCase()} PROPOSAL ────`);
        parts.push(proposal);
        parts.push('');
    }

    parts.push('Produce the single best merged solution.');

    return parts.join('\n');
}

/**
 * Truncate text to a max character count, adding an indicator.
 */
function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '\n... (truncated)';
}
