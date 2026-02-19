/* ──────────────────────────────────────────────
   Qwen Controller — qwen.ai automation
   ────────────────────────────────────────────── */

import { BaseController } from '../base-controller';
import { SELECTORS, ModelSelectors } from '../selectors';

export class QwenController extends BaseController {
    readonly modelName = 'qwen';
    readonly selectors: ModelSelectors = SELECTORS.qwen;

    /**
     * Qwen uses a standard textarea.
     */
    protected async typePrompt(prompt: string): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const textarea = await this.page.waitForSelector(this.selectors.textarea, {
            timeout: 10000,
        });
        if (!textarea) throw new Error('Qwen textarea not found');

        await textarea.click();
        await textarea.fill('');
        await textarea.fill(prompt);
        await this.page.waitForTimeout(300);
    }

    /**
     * Qwen response extraction.
     */
    protected async extractResponse(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const elements = await this.page.$$(this.selectors.responseContainer);
        if (elements.length === 0) throw new Error('No Qwen response found');

        const lastEl = elements[elements.length - 1];
        const html = await lastEl.innerHTML();

        return this.htmlToMarkdown(html);
    }

    /**
     * Qwen submit — may need to use Ctrl+Enter on some versions.
     */
    protected async submitPrompt(): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');
        await this.page.waitForTimeout(300);

        const btn = await this.page.$(this.selectors.sendButton);
        if (btn) {
            await btn.click();
        } else {
            // Fallback: Ctrl+Enter or Enter
            await this.page.keyboard.press('Enter');
        }
    }
}
