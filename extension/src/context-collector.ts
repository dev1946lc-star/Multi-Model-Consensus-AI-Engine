/* ──────────────────────────────────────────────
   Context Collector — gather VS Code workspace
   context for AI prompts.
   ────────────────────────────────────────────── */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface CollectedContext {
    currentFile: string;
    currentFileContent: string;
    selectedText?: string;
    selectionRange?: {
        startLine: number;
        startChar: number;
        endLine: number;
        endChar: number;
    };
    openFiles: string[];
    projectTree?: string;
}

/**
 * Collect context from the current VS Code state.
 */
export function collectContext(): CollectedContext {
    const editor = vscode.window.activeTextEditor;

    const ctx: CollectedContext = {
        currentFile: '',
        currentFileContent: '',
        openFiles: [],
    };

    if (editor) {
        ctx.currentFile = editor.document.uri.fsPath;
        ctx.currentFileContent = editor.document.getText();

        // Selected text
        const selection = editor.selection;
        if (!selection.isEmpty) {
            ctx.selectedText = editor.document.getText(selection);
            ctx.selectionRange = {
                startLine: selection.start.line,
                startChar: selection.start.character,
                endLine: selection.end.line,
                endChar: selection.end.character,
            };
        }
    }

    // Open files
    ctx.openFiles = vscode.window.tabGroups.all
        .flatMap((g) => g.tabs)
        .filter((tab) => tab.input instanceof vscode.TabInputText)
        .map((tab) => (tab.input as vscode.TabInputText).uri.fsPath);

    // Project tree (limited depth)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        ctx.projectTree = buildProjectTree(workspaceFolders[0].uri.fsPath, 3);
    }

    return ctx;
}

/**
 * Build a simple directory tree string with limited depth.
 */
function buildProjectTree(rootPath: string, maxDepth: number): string {
    const lines: string[] = [];
    const rootName = path.basename(rootPath);
    lines.push(rootName + '/');

    walkDir(rootPath, '', maxDepth, 0, lines);

    return lines.join('\n');
}

function walkDir(
    dir: string,
    prefix: string,
    maxDepth: number,
    currentDepth: number,
    lines: string[]
): void {
    if (currentDepth >= maxDepth) return;

    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    // Filter out common noise
    const IGNORE = new Set([
        'node_modules', '.git', '.next', 'dist', 'out',
        '.vscode', '__pycache__', '.DS_Store', 'coverage',
        '.env', '.env.local',
    ]);

    const filtered = entries
        .filter((e) => !IGNORE.has(e.name) && !e.name.startsWith('.'))
        .sort((a, b) => {
            // Directories first
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
        })
        .slice(0, 30); // Cap at 30 entries per level

    for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
        const isLast = i === filtered.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';

        if (entry.isDirectory()) {
            lines.push(prefix + connector + entry.name + '/');
            walkDir(
                path.join(dir, entry.name),
                prefix + childPrefix,
                maxDepth,
                currentDepth + 1,
                lines
            );
        } else {
            lines.push(prefix + connector + entry.name);
        }
    }
}
