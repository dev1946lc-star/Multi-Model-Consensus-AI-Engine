/* ──────────────────────────────────────────────
   Parse AI markdown responses into structured
   code blocks and detect diffs vs full files.
   ────────────────────────────────────────────── */

import { CodeBlock } from './message-types';

/**
 * Extract all fenced code blocks from a markdown response.
 *
 * Supports:
 *   ```lang\n...\n```
 *   ```lang:filename\n...\n```
 *   Unified diff detection (lines starting with --- / +++ / @@ )
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
    const blocks: CodeBlock[] = [];
    const regex = /```(\w*(?::\S+)?)\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(markdown)) !== null) {
        const langTag = match[1] || '';
        const code = match[2].trimEnd();

        // Parse optional filename from lang:filename
        let language = langTag;
        let filename: string | undefined;
        if (langTag.includes(':')) {
            const parts = langTag.split(':');
            language = parts[0];
            filename = parts.slice(1).join(':');
        }

        const isDiff = detectDiff(code, language);

        blocks.push({
            language: language || inferLanguage(code),
            code,
            filename,
            isDiff,
        });
    }

    return blocks;
}

/**
 * Detect if a code block contains a unified diff.
 */
function detectDiff(code: string, language: string): boolean {
    if (language === 'diff') return true;

    const lines = code.split('\n');
    let hasPlusMinus = false;
    let hasHunkHeader = false;

    for (const line of lines) {
        if (line.startsWith('---') || line.startsWith('+++')) hasPlusMinus = true;
        if (line.startsWith('@@')) hasHunkHeader = true;
        if (hasPlusMinus && hasHunkHeader) return true;
    }

    return false;
}

/**
 * Infer language from code content heuristics.
 */
function inferLanguage(code: string): string {
    if (code.includes('import React') || code.includes('from "react"')) return 'tsx';
    if (code.includes('export default') || code.includes('const ') || code.includes('function ')) return 'typescript';
    if (code.includes('def ') || code.includes('import ') || code.includes('class ')) return 'python';
    if (code.includes('#include') || code.includes('int main')) return 'cpp';
    return 'text';
}

/**
 * Extract the non-code explanation text from a markdown response.
 */
export function extractExplanation(markdown: string): string {
    // Remove all fenced code blocks
    const withoutCode = markdown.replace(/```[\s\S]*?```/g, '').trim();
    // Collapse excessive whitespace
    return withoutCode.replace(/\n{3,}/g, '\n\n');
}

/**
 * Parse a filename hint from the response.
 * Looks for patterns like: `// filename: path/to/file.ts`
 */
export function extractFilenameHint(code: string): string | undefined {
    const patterns = [
        /\/\/\s*filename:\s*(\S+)/i,
        /\/\/\s*file:\s*(\S+)/i,
        /#\s*filename:\s*(\S+)/i,
        /\/\*\s*filename:\s*(\S+)\s*\*\//i,
    ];

    for (const pattern of patterns) {
        const m = code.match(pattern);
        if (m) return m[1];
    }

    return undefined;
}
