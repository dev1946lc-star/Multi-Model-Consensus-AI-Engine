/* ──────────────────────────────────────────────
   DeepSeek Controller — chat.deepseek.com automation
   ────────────────────────────────────────────── */

import { BaseController } from '../base-controller';
import { SELECTORS, ModelSelectors } from '../selectors';

export class DeepSeekController extends BaseController {
    readonly modelName = 'deepseek';
    readonly selectors: ModelSelectors = SELECTORS.deepseek;

    /**
     * DeepSeek uses a standard textarea input.
     */
    protected async typePrompt(prompt: string): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const textarea = await this.page.waitForSelector(this.selectors.textarea, {
            timeout: 10000,
        });
        if (!textarea) throw new Error('DeepSeek textarea not found');

        await textarea.click();
        await textarea.fill('');
        await textarea.fill(prompt);
        await this.page.waitForTimeout(300);
    }

    /**
     * DeepSeek response extraction — responses are in .ds-markdown divs.
     */
    protected async extractResponse(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const elements = await this.page.$$(this.selectors.responseContainer);
        if (elements.length === 0) throw new Error('No DeepSeek response found');

        const lastEl = elements[elements.length - 1];
        const html = await lastEl.innerHTML();

        return this.htmlToMarkdown(html);
    }

    /**
     * DeepSeek has a "Think" mode — wait for both thinking and response.
     */
    protected async waitForCompletion(timeout = 120_000): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        // Wait for response to start
        try {
            await this.page.waitForSelector(this.selectors.streamingIndicator, {
                state: 'visible',
                timeout: 15000,
            });
        } catch {
            // May respond instantly
        }

        // Wait for streaming to stop
        try {
            await this.page.waitForSelector(this.selectors.streamingIndicator, {
                state: 'hidden',
                timeout,
            });
        } catch {
            console.warn('[deepseek] Timeout waiting for response');
        }

        await this.page.waitForTimeout(1500);
    }
}
