/* ──────────────────────────────────────────────
   Base Controller — abstract class for all
   AI model automation controllers.
   ────────────────────────────────────────────── */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ModelSelectors } from './selectors';

/** Response from a model controller */
export interface ModelResponse {
    model: string;
    proposal: string;
    codeBlocks: Array<{ language: string; code: string; filename?: string; isDiff: boolean }>;
    confidence: number;
    error?: string;
    latencyMs: number;
}

/**
 * Abstract base class for all model controllers.
 *
 * Subclasses must implement:
 *   - modelName: identifier
 *   - selectors: CSS selectors for the model's web UI
 *   - extractResponse(): how to parse the model's response
 *
 * The base class provides:
 *   - Browser lifecycle management
 *   - Persistent profile reuse (login session)
 *   - Common ask() flow with retry
 *   - Timeout handling
 */
export abstract class BaseController {
    abstract readonly modelName: string;
    abstract readonly selectors: ModelSelectors;

    protected browser: Browser | null = null;
    protected context: BrowserContext | null = null;
    protected page: Page | null = null;
    private ready = false;

    /** User data directory for persistent browser profile */
    protected get userDataDir(): string {
        const home = process.env.USERPROFILE || process.env.HOME || '';
        return `${home}/.copilot-browsers/${this.modelName}`;
    }

    /**
     * Launch the browser and navigate to the model's page.
     * Reuses the existing browser profile (logged-in session).
     */
    async launch(): Promise<void> {
        console.log(`[${this.modelName}] Launching browser...`);

        this.context = await chromium.launchPersistentContext(this.userDataDir, {
            headless: false,
            viewport: { width: 1280, height: 900 },
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check',
            ],
        });

        this.page = this.context.pages()[0] || await this.context.newPage();

        // Navigate to the model's URL
        await this.page.goto(this.selectors.url, { waitUntil: 'domcontentloaded' });
        await this.page.waitForTimeout(2000);

        this.ready = true;
        console.log(`[${this.modelName}] Ready at ${this.selectors.url}`);
    }

    /**
     * Check if the controller is initialized and ready.
     */
    isReady(): boolean {
        return this.ready && this.page !== null;
    }

    /**
     * Send a prompt and get a response. Includes retry logic.
     */
    async ask(prompt: string, maxRetries = 2): Promise<ModelResponse> {
        if (!this.page) throw new Error(`${this.modelName} not launched`);

        const start = Date.now();

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Clear any existing input
                await this.clearInput();

                // Type the prompt
                await this.typePrompt(prompt);

                // Submit
                await this.submitPrompt();

                // Wait for response to complete
                await this.waitForCompletion();

                // Extract the response
                const rawResponse = await this.extractResponse();

                // Parse code blocks
                const codeBlocks = this.parseCodeBlocks(rawResponse);

                return {
                    model: this.modelName,
                    proposal: rawResponse,
                    codeBlocks,
                    confidence: 0.7 + (codeBlocks.length > 0 ? 0.2 : 0),
                    latencyMs: Date.now() - start,
                };
            } catch (err: any) {
                console.warn(`[${this.modelName}] Attempt ${attempt + 1} failed: ${err.message}`);
                if (attempt === maxRetries) {
                    return {
                        model: this.modelName,
                        proposal: '',
                        codeBlocks: [],
                        confidence: 0,
                        error: err.message,
                        latencyMs: Date.now() - start,
                    };
                }
                await this.page.waitForTimeout(3000);
            }
        }

        // Should never reach here
        throw new Error('Unreachable');
    }

    /**
     * Type the prompt into the textarea or contenteditable.
     */
    protected async typePrompt(prompt: string): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const { textarea, contentEditable } = this.selectors;

        if (contentEditable) {
            // For contenteditable elements (Claude, Gemini, Kimi)
            const el = await this.page.waitForSelector(contentEditable, { timeout: 10000 });
            if (el) {
                await el.click();
                await this.page.keyboard.press('Control+A');
                await this.page.keyboard.press('Backspace');
                // Type in chunks to avoid overwhelming
                for (const chunk of splitIntoChunks(prompt, 500)) {
                    await this.page.keyboard.type(chunk, { delay: 5 });
                }
                return;
            }
        }

        // Fallback to textarea
        const ta = await this.page.waitForSelector(textarea, { timeout: 10000 });
        if (ta) {
            await ta.click();
            await ta.fill(prompt);
        }
    }

    /**
     * Click the send button.
     */
    protected async submitPrompt(): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        // Short delay to let UI update
        await this.page.waitForTimeout(500);

        // Try clicking send button
        const btn = await this.page.$(this.selectors.sendButton);
        if (btn) {
            await btn.click();
        } else {
            // Fallback: press Enter
            await this.page.keyboard.press('Enter');
        }
    }

    /**
     * Wait for the model to finish generating its response.
     */
    protected async waitForCompletion(timeout = 120_000): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const { streamingIndicator } = this.selectors;

        // Wait for streaming to start (indicator appears)
        try {
            await this.page.waitForSelector(streamingIndicator, {
                state: 'visible',
                timeout: 15000,
            });
        } catch {
            // Indicator may already be gone for fast responses
        }

        // Wait for streaming to stop (indicator disappears)
        try {
            await this.page.waitForSelector(streamingIndicator, {
                state: 'hidden',
                timeout,
            });
        } catch {
            console.warn(`[${this.modelName}] Timeout waiting for generation to complete`);
        }

        // Extra settle time
        await this.page.waitForTimeout(1000);
    }

    /**
     * Extract the last assistant message from the page.
     * Subclasses can override for model-specific extraction.
     */
    protected async extractResponse(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const { responseContainer } = this.selectors;

        // Get all response elements
        const elements = await this.page.$$(responseContainer);
        if (elements.length === 0) {
            throw new Error('No response found on page');
        }

        // Get the last (most recent) response
        const lastEl = elements[elements.length - 1];
        const text = await lastEl.innerText();
        const html = await lastEl.innerHTML();

        // Prefer extracting markdown from inner HTML if code blocks are present
        if (html.includes('<code') || html.includes('<pre')) {
            return this.htmlToMarkdown(html);
        }

        return text;
    }

    /**
     * Clear the input field.
     */
    protected async clearInput(): Promise<void> {
        if (!this.page) return;
        const { textarea, contentEditable } = this.selectors;
        const selector = contentEditable || textarea;

        try {
            const el = await this.page.$(selector);
            if (el) {
                await el.click();
                await this.page.keyboard.press('Control+A');
                await this.page.keyboard.press('Backspace');
            }
        } catch {
            // Ignore clear errors
        }
    }

    /**
     * Simple HTML to markdown conversion for code blocks.
     */
    protected htmlToMarkdown(html: string): string {
        let md = html;

        // Convert <pre><code> blocks
        md = md.replace(/<pre[^>]*><code[^>]*class="[^"]*language-(\w+)[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
            (_, lang, code) => `\`\`\`${lang}\n${decodeHtml(code)}\n\`\`\``
        );
        md = md.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
            (_, code) => `\`\`\`\n${decodeHtml(code)}\n\`\`\``
        );

        // Convert inline code
        md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');

        // Strip remaining HTML tags
        md = md.replace(/<[^>]+>/g, '');

        // Decode entities
        md = decodeHtml(md);

        return md.trim();
    }

    /**
     * Parse code blocks from the response text.
     */
    protected parseCodeBlocks(text: string): Array<{
        language: string;
        code: string;
        filename?: string;
        isDiff: boolean;
    }> {
        const blocks: Array<{ language: string; code: string; filename?: string; isDiff: boolean }> = [];
        const regex = /```(\w*)\s*\n([\s\S]*?)```/g;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            const lang = match[1] || 'text';
            const code = match[2].trimEnd();
            const isDiff = lang === 'diff' || (code.includes('---') && code.includes('+++') && code.includes('@@'));

            blocks.push({ language: lang, code, isDiff });
        }

        return blocks;
    }

    /**
     * Gracefully close the browser.
     */
    async close(): Promise<void> {
        this.ready = false;
        try {
            await this.context?.close();
        } catch {
            // Ignore close errors
        }
        this.browser = null;
        this.context = null;
        this.page = null;
        console.log(`[${this.modelName}] Closed`);
    }
}

/** Utility: split text into chunks of N characters */
function splitIntoChunks(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
        chunks.push(text.slice(i, i + size));
    }
    return chunks;
}

/** Decode HTML entities */
function decodeHtml(html: string): string {
    return html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/');
}
