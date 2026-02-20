import { extractJSON } from "./json-extract";

export function consensusFiles(modelOutputs: string[]) {
    const parsed = modelOutputs.map(extractJSON).filter(Boolean);

    const fileMap = new Map<string, string>();

    for (const model of parsed) {
        for (const f of model.files || []) {
            if (!fileMap.has(f.path)) {
                fileMap.set(f.path, f.content);
            }
        }
    }

    const files = Array.from(fileMap.entries()).map(
        ([path, content]) => ({ path, content })
    );

    return {
        files,
        dependencies: parsed.flatMap(p => p.dependencies || []),
    };
}
