import {
    ChatGPTController,
    ClaudeController,
    GeminiController,
} from "automation";
import { runConsensus } from "./consensus";
import { planApp } from "../planner/app-planner";

export async function handleTask(req: any) {
    if (req.mode === "build") {
        return buildApp(req.prompt);
    }
    return editTask(req.prompt);
}

async function editTask(prompt: string) {
    const models = [
        new ChatGPTController(),
        new ClaudeController(),
        new GeminiController(),
    ];

    await Promise.all(models.map(m => m.launch()));

    const proposals = await Promise.all(
        models.map(m => m.ask(prompt))
    );

    return runConsensus(proposals);
}

async function buildApp(spec: string) {
    const plan = await planApp(spec);
    return { type: "app-plan", plan };
}
