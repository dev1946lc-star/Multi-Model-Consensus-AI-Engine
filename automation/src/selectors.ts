/* ──────────────────────────────────────────────
   Centralized selectors for all supported
   AI model web interfaces.
   
   Update these when model UIs change.
   ────────────────────────────────────────────── */

export interface ModelSelectors {
    /** URL of the model's web interface */
    url: string;
    /** Selector for the prompt textarea / contenteditable */
    textarea: string;
    /** Selector for the send / submit button */
    sendButton: string;
    /** Selector for the last assistant response container */
    responseContainer: string;
    /** Selector for the streaming/thinking indicator (visible while generating) */
    streamingIndicator: string;
    /** Selector that appears when generation is complete */
    completionIndicator?: string;
    /** Alternative textarea selector (some models use contenteditable divs) */
    contentEditable?: string;
}

export const SELECTORS: Record<string, ModelSelectors> = {

    chatgpt: {
        url: 'https://chatgpt.com',
        textarea: '#prompt-textarea',
        sendButton: 'button[data-testid="send-button"]',
        responseContainer: '[data-message-author-role="assistant"]',
        streamingIndicator: 'button[aria-label="Stop generating"]',
        contentEditable: '#prompt-textarea',
    },

    claude: {
        url: 'https://claude.ai',
        textarea: '[contenteditable="true"].ProseMirror',
        sendButton: 'button[aria-label="Send Message"]',
        responseContainer: '[data-testid="chat-message-content"]',
        streamingIndicator: 'button[aria-label="Stop Response"]',
        contentEditable: '[contenteditable="true"].ProseMirror',
    },

    gemini: {
        url: 'https://gemini.google.com/app',
        textarea: '.ql-editor[contenteditable="true"]',
        sendButton: 'button[aria-label="Send message"]',
        responseContainer: '.response-container-content',
        streamingIndicator: '.loading-indicator',
        contentEditable: '.ql-editor[contenteditable="true"]',
    },

    deepseek: {
        url: 'https://chat.deepseek.com',
        textarea: 'textarea#chat-input',
        sendButton: 'div[role="button"][aria-label="Send"]',
        responseContainer: '.ds-markdown',
        streamingIndicator: '.loading-anim',
        contentEditable: 'textarea#chat-input',
    },

    qwen: {
        url: 'https://qwen.ai',
        textarea: 'textarea[placeholder]',
        sendButton: 'button[type="submit"]',
        responseContainer: '.message-content-container',
        streamingIndicator: '.generating-indicator',
    },

    kimi: {
        url: 'https://kimi.moonshot.cn',
        textarea: '[contenteditable="true"]',
        sendButton: 'button.send-button',
        responseContainer: '.chat-message-content',
        streamingIndicator: '.typing-indicator',
        contentEditable: '[contenteditable="true"]',
    },
};
