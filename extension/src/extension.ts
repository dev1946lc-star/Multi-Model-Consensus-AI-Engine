import * as vscode from "vscode";
import { BridgeClient } from "./bridge-client";

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
            const spec = await vscode.window.showInputBox({
                prompt: "Describe the app",
            });

            const res = await bridge.request({
                mode: "build",
                prompt: spec,
            });

            vscode.window.showInformationMessage("App plan created");
        })
    );
}
