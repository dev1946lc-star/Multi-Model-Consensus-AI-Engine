export const buildProposalPrompt = (task: string) =>
    `You are a senior software engineer. Produce code edits.\n\nTask:\n${task}`;

export const buildCritiquePrompt = (proposal: string) =>
    `Critique this code for correctness, completeness, safety, style and performance:\n${proposal}`;

export const buildJudgePrompt = (a: string, b: string) =>
    `Which implementation is better and why?\n\nA:\n${a}\n\nB:\n${b}`;

export const buildFilePrompt = (filePath: string, spec: string) =>
    `Create the file ${filePath} for this project:\n${spec}`;
