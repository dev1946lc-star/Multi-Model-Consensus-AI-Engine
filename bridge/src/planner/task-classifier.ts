export function classifyTask(prompt: string) {
    if (/build|create|scaffold/i.test(prompt)) return "build";
    return "edit";
}
