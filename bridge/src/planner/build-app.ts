import { planApp } from "./app-planner";
import { buildAppPrompt, ChatGPTController, ClaudeController, GeminiController } from "automation";
import { consensusFiles } from "./consensus-files";
import { selectTemplate } from "./template-selector";
import * as fs from "fs";
import * as path from "path";

export function loadTemplate(dir: string) {
    const files: { path: string; content: string }[] = [];

    function walk(p: string) {
        if (!fs.existsSync(p)) return;
        for (const f of fs.readdirSync(p)) {
            const full = path.join(p, f);
            if (fs.statSync(full).isDirectory()) walk(full);
            else {
                files.push({
                    path: path.relative(dir, full).replace(/\\/g, "/"),
                    content: fs.readFileSync(full, "utf8"),
                });
            }
        }
    }

    walk(dir);
    return files;
}

export async function buildApp(userPrompt: string) {
    const spec = planApp(userPrompt);
    const prompt = buildAppPrompt(JSON.stringify(spec));

    const models = [
        new ChatGPTController(),
        new ClaudeController(),
        new GeminiController(),
    ];

    await Promise.all(models.map(m => m.launch()));

    const outputs = await Promise.all(
        models.map(m => m.ask(prompt))
    );

    await Promise.all(models.map(m => m.close()));

    const merged = consensusFiles(outputs);

    const templateDir = path.join(__dirname, "../../templates", process.env.NODE_ENV !== "production" ? selectTemplate(spec).replace("templates/", "") : selectTemplate(spec));
    // A safer path resolution that handles different execution context
    const targetDir = path.resolve(__dirname, "../../", selectTemplate(spec));

    const baseFiles = loadTemplate(targetDir);

    merged.files = [...baseFiles, ...merged.files];

    return merged;
}
