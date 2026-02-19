/* ──────────────────────────────────────────────
   Gemini Controller — gemini.google.com automation
   ────────────────────────────────────────────── */

import { BaseController } from '../base-controller';
import { SELECTORS, ModelSelectors } from '../selectors';

export class GeminiController extends BaseController {
    readonly modelName = 'gemini';
    readonly selectors: ModelSelectors = SELECTORS.gemini;

    /**
     * Gemini uses a Quill-based rich text editor.
     */
    protected async typePrompt(prompt: string): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const editor = await this.page.waitForSelector(this.selectors.contentEditable!, {
            timeout: 10000,
        });
        if (!editor) throw new Error('Gemini editor not found');

        await editor.click();
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(200);

        // Paste via clipboard for speed with large prompts
        await this.page.evaluate((text) => {
            const editor = document.querySelector('.ql-editor[contenteditable="true"]');
            if (editor) {
                (editor as HTMLElement).focus();
                document.execCommand('selectAll');
                document.execCommand('delete');
                document.execCommand('insertText', false, text);
            }
        }, prompt);

        await this.page.waitForTimeout(500);
    }

    /**
     * Gemini response extraction.
     */
    protected async extractResponse(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        // Gemini responses are in message containers
        const elements = await this.page.$$(this.selectors.responseContainer);
        if (elements.length === 0) throw new Error('No Gemini response found');

        const lastEl = elements[elements.length - 1];
        const html = await lastEl.innerHTML();

        return this.htmlToMarkdown(html);
    }

    /**
     * Gemini may require an additional wait for its loading animation.
     */
    protected async waitForCompletion(timeout = 120_000): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        // Wait for "thinking" or loading states
        try {
            await this.page.waitForSelector('.loading-indicator', {
                state: 'visible',
                timeout: 10000,
            });
        } catch {
            // May have finished instantly
        }

        try {
            await this.page.waitForSelector('.loading-indicator', {
                state: 'hidden',
                timeout,
            });
        } catch {
            console.warn('[gemini] Timeout waiting for response');
        }

        // Wait for final content render
        await this.page.waitForTimeout(2000);
    }
}
