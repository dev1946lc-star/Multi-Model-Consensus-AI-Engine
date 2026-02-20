import { ChatGPTController } from "automation";

export async function generateFile(path: string, spec: string) {
    const model = new ChatGPTController();
    await model.launch();
    const content = await model.ask(`Create file ${path}\n${spec}`);
    return { path, content };
}
