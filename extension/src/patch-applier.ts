/* ──────────────────────────────────────────────
   Patch Applier — show diff preview and apply
   AI-generated edits to the workspace.
   ────────────────────────────────────────────── */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface Edit {
    file: string;
    range?: {
        startLine: number;
        startChar: number;
        endLine: number;
        endChar: number;
    };
    newText: string;
    action: 'replace' | 'create' | 'full';
}

/**
 * Apply a set of edits returned by the bridge server.
 * Shows a diff preview for each edit before applying.
 */
export async function applyEdits(edits: Edit[]): Promise<void> {
    if (!edits || edits.length === 0) {
        vscode.window.showInformationMessage('No edits to apply.');
        return;
    }

    for (const edit of edits) {
        try {
            switch (edit.action) {
                case 'create':
                    await handleCreateFile(edit);
                    break;
                case 'full':
                    await handleFullReplace(edit);
                    break;
                case 'replace':
                    await handleRangeReplace(edit);
                    break;
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to apply edit to ${edit.file}: ${err.message}`);
        }
    }
}

/**
 * Create a new file with the provided content.
 */
async function handleCreateFile(edit: Edit): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder open');
    }

    const filePath = path.isAbsolute(edit.file)
        ? edit.file
        : path.join(workspaceFolders[0].uri.fsPath, edit.file);

    // Create parent directories
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Check if file already exists
    if (fs.existsSync(filePath)) {
        const choice = await vscode.window.showWarningMessage(
            `File ${path.basename(filePath)} already exists. Overwrite?`,
            'Overwrite',
            'Cancel'
        );
        if (choice !== 'Overwrite') return;
    }

    fs.writeFileSync(filePath, edit.newText, 'utf-8');
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage(`Created: ${path.basename(filePath)}`);
}

/**
 * Replace the entire content of a file, with diff preview.
 */
async function handleFullReplace(edit: Edit): Promise<void> {
    const uri = resolveFileUri(edit.file);
    if (!uri) return;

    // Show diff preview
    const accepted = await showDiffPreview(uri, edit.newText, 'Full file replacement');
    if (!accepted) return;

    // Apply the edit
    const doc = await vscode.workspace.openTextDocument(uri);
    const wsEdit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(doc.lineCount, 0)
    );
    wsEdit.replace(uri, fullRange, edit.newText);
    await vscode.workspace.applyEdit(wsEdit);
}

/**
 * Replace a specific range in a file, with diff preview.
 */
async function handleRangeReplace(edit: Edit): Promise<void> {
    if (!edit.range) {
        return handleFullReplace(edit);
    }

    const uri = resolveFileUri(edit.file);
    if (!uri) return;

    // Show diff preview
    const accepted = await showDiffPreview(uri, edit.newText, 'Range replacement');
    if (!accepted) return;

    const wsEdit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(
        new vscode.Position(edit.range.startLine, edit.range.startChar),
        new vscode.Position(edit.range.endLine, edit.range.endChar)
    );
    wsEdit.replace(uri, range, edit.newText);
    await vscode.workspace.applyEdit(wsEdit);
}

/**
 * Show a side-by-side diff preview. Returns true if user accepts.
 */
async function showDiffPreview(
    originalUri: vscode.Uri,
    newContent: string,
    title: string
): Promise<boolean> {
    // Create a temporary URI for the modified content
    const scheme = 'copilot-preview';
    const modifiedUri = originalUri.with({
        scheme,
        path: originalUri.path,
        query: Date.now().toString(),
    });

    // Register a content provider for the preview
    const provider = new (class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(): string {
            return newContent;
        }
    })();

    const disposable = vscode.workspace.registerTextDocumentContentProvider(scheme, provider);

    try {
        // Show diff editor
        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            modifiedUri,
            `AI Suggestion: ${title}`
        );

        // Ask user to accept or reject
        const choice = await vscode.window.showInformationMessage(
            'Apply this AI suggestion?',
            'Apply',
            'Reject'
        );

        return choice === 'Apply';
    } finally {
        disposable.dispose();
    }
}

/**
 * Resolve a file path to a VS Code URI.
 */
function resolveFileUri(filePath: string): vscode.Uri | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (path.isAbsolute(filePath)) {
        return vscode.Uri.file(filePath);
    }

    if (workspaceFolders) {
        return vscode.Uri.file(path.join(workspaceFolders[0].uri.fsPath, filePath));
    }

    vscode.window.showErrorMessage(`Cannot resolve file: ${filePath}`);
    return undefined;
}
