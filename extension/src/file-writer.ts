import * as vscode from "vscode";
import * as path from "path";

function safePath(root: string, filePath: string) {
    const full = path.join(root, filePath);
    // Ensure the resolved full path strictly starts with the root path
    if (!full.startsWith(root)) {
        throw new Error("Unsafe path from model");
    }
    return full;
}

export async function writeProject(files: { path: string, content: string }[]) {
    const root = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!root) return;

    for (const f of files) {
        const full = safePath(root, f.path);
        const uri = vscode.Uri.file(full);

        await vscode.workspace.fs.createDirectory(
            vscode.Uri.file(path.dirname(full))
        );

        await vscode.workspace.fs.writeFile(
            uri,
            Buffer.from(f.content)
        );
    }
}
