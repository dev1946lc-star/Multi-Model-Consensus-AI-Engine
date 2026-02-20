import { AppSpec } from "./app-planner";

export function selectTemplate(spec: AppSpec) {
    switch (spec.framework) {
        case "react":
            return "templates/react-vite";
        case "next":
            return "templates/nextjs";
        case "node":
            return "templates/node-api";
        default:
            return "templates/vite";
    }
}
