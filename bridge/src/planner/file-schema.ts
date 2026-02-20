export interface GeneratedFile {
    path: string;
    content: string;
}

export interface AppPlan {
    name: string;
    framework: string;
    files: GeneratedFile[];
    dependencies: string[];
}
