/* ──────────────────────────────────────────────
   Patch Engine — convert parsed code blocks
   into structured workspace edits.
   ────────────────────────────────────────────── */

import { CodeBlock, Edit } from './message-types';
import { extractFilenameHint } from './response-parser';

/**
 * Convert code blocks into structured edits.
 *
 * Strategy:
 *   - diff blocks → parse hunks into range-based replacements
 *   - full file blocks → full file replacement or creation
 *   - blocks with filename hints → create file
 */
export function buildEdits(
    codeBlocks: CodeBlock[],
    currentFile: string,
    selectionRange?: { startLine: number; startChar: number; endLine: number; endChar: number }
): Edit[] {
    const edits: Edit[] = [];

    for (const block of codeBlocks) {
        if (block.isDiff) {
            edits.push(...parseDiffToEdits(block, currentFile));
        } else {
            const filename = block.filename || extractFilenameHint(block.code) || currentFile;
            const isNewFile = block.filename && block.filename !== currentFile;

            if (isNewFile) {
                edits.push({
                    file: filename,
                    newText: block.code,
                    action: 'create',
                });
            } else if (selectionRange) {
                // Replace the selected range
                edits.push({
                    file: filename,
                    range: selectionRange,
                    newText: block.code,
                    action: 'replace',
                });
            } else {
                // Full file replacement
                edits.push({
                    file: filename,
                    newText: block.code,
                    action: 'full',
                });
            }
        }
    }

    return edits;
}

/**
 * Parse unified diff hunks into range-based edits.
 *
 * Supports standard unified diff format:
 *   --- a/file
 *   +++ b/file
 *   @@ -start,count +start,count @@
 *    context
 *   -removed
 *   +added
 */
function parseDiffToEdits(block: CodeBlock, fallbackFile: string): Edit[] {
    const edits: Edit[] = [];
    const lines = block.code.split('\n');

    let targetFile = fallbackFile;
    let i = 0;

    // Parse header
    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith('+++ ')) {
            targetFile = line.slice(4).replace(/^b\//, '').trim() || fallbackFile;
        }
        if (line.startsWith('@@')) break;
        i++;
    }

    // Parse hunks
    while (i < lines.length) {
        const line = lines[i];
        const hunkMatch = line.match(/^@@\s*-(\d+)(?:,(\d+))?\s*\+(\d+)(?:,(\d+))?\s*@@/);
        if (!hunkMatch) {
            i++;
            continue;
        }

        const startLine = parseInt(hunkMatch[1], 10);
        const oldCount = parseInt(hunkMatch[2] || '1', 10);
        i++;

        // Collect new content for this hunk
        const newLines: string[] = [];
        let linesConsumed = 0;

        while (i < lines.length && !lines[i].startsWith('@@')) {
            const hLine = lines[i];
            if (hLine.startsWith('-')) {
                linesConsumed++;
            } else if (hLine.startsWith('+')) {
                newLines.push(hLine.slice(1));
            } else if (hLine.startsWith(' ') || hLine === '') {
                newLines.push(hLine.startsWith(' ') ? hLine.slice(1) : hLine);
                linesConsumed++;
            }
            i++;
        }

        edits.push({
            file: targetFile,
            range: {
                startLine: startLine - 1, // 0-indexed
                startChar: 0,
                endLine: startLine - 1 + oldCount,
                endChar: 0,
            },
            newText: newLines.join('\n'),
            action: 'replace',
        });
    }

    return edits;
}
