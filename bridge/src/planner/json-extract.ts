export function extractJSON(text: string): any {
    try {
        // remove markdown fences
        const cleaned = text
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");

        if (start === -1 || end === -1) return null;

        return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
        return null;
    }
}
