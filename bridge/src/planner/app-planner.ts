export async function planApp(spec: string) {
    return {
        framework: "nextjs",
        files: [
            "package.json",
            "app/page.tsx",
            "app/layout.tsx",
            "components/Nav.tsx",
            "lib/db.ts",
        ],
        spec,
    };
}
