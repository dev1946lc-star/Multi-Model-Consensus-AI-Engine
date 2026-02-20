import * as vscode from "vscode";
import { BridgeClient } from "./bridge-client";
import { writeProject } from "./file-writer";

export function activate(ctx: vscode.ExtensionContext) {
    const bridge = new BridgeClient();
    bridge.connect();

    ctx.subscriptions.push(
        vscode.commands.registerCommand("localCopilot.ask", async () => {
            const editor = vscode.window.activeTextEditor;
            const text = editor?.document.getText(editor.selection);

            const res = await bridge.request({
                mode: "edit",
                prompt: text,
            });

            vscode.window.showInformationMessage(res.winner);
        })
    );

    ctx.subscriptions.push(
        vscode.commands.registerCommand("localCopilot.buildApp", async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: "Describe the app",
            });

            if (!prompt) return;

            const res = await bridge.request({
                type: "buildApp",
                prompt,
            });

            if (res && res.result && res.result.files) {
                await writeProject(res.result.files);
                vscode.window.showInformationMessage("App generated!");
            } else {
                vscode.window.showErrorMessage("Failed to generate app.");
            }
        })
    );
}
