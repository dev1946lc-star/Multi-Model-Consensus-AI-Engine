export interface AppSpec {
    name: string;
    framework: "react" | "next" | "node" | "vite" | "vanilla";
    features: string[];
}

export function planApp(prompt: string): AppSpec {
    const p = prompt.toLowerCase();

    let framework: AppSpec["framework"] = "vite";

    if (p.includes("next")) framework = "next";
    else if (p.includes("react")) framework = "react";
    else if (p.includes("node") || p.includes("api")) framework = "node";

    return {
        name: "generated-app",
        framework,
        features: [],
    };
}
