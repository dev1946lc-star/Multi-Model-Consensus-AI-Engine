export const selectors = {
    chatgpt: {
        input: "textarea",
        response: "[data-message-author-role='assistant']",
    },
    claude: {
        input: "textarea",
        response: "[data-test-render-count]",
    },
    gemini: {
        input: "textarea",
        response: ".response-content",
    },
    deepseek: {
        input: "textarea",
        response: ".assistant-message",
    },
    qwen: {
        input: "textarea",
        response: ".answer",
    },
    kimi: {
        input: "textarea",
        response: ".markdown",
    },
};
