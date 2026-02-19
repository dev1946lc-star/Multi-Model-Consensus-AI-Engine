/* ──────────────────────────────────────────────
   Kimi Controller — kimi.moonshot.cn automation
   ────────────────────────────────────────────── */

import { BaseController } from '../base-controller';
import { SELECTORS, ModelSelectors } from '../selectors';

export class KimiController extends BaseController {
    readonly modelName = 'kimi';
    readonly selectors: ModelSelectors = SELECTORS.kimi;

    /**
     * Kimi uses a contenteditable div.
     */
    protected async typePrompt(prompt: string): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const editor = await this.page.waitForSelector(this.selectors.contentEditable!, {
            timeout: 10000,
        });
        if (!editor) throw new Error('Kimi editor not found');

        await editor.click();
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(200);

        // Use execCommand for contenteditable
        await this.page.evaluate((text) => {
            const editor = document.querySelector('[contenteditable="true"]');
            if (editor) {
                (editor as HTMLElement).focus();
                document.execCommand('selectAll');
                document.execCommand('delete');
                document.execCommand('insertText', false, text);
            }
        }, prompt);

        await this.page.waitForTimeout(300);
    }

    /**
     * Kimi response extraction.
     */
    protected async extractResponse(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const elements = await this.page.$$(this.selectors.responseContainer);
        if (elements.length === 0) throw new Error('No Kimi response found');

        const lastEl = elements[elements.length - 1];
        const html = await lastEl.innerHTML();

        return this.htmlToMarkdown(html);
    }

    /**
     * Kimi submit — click send button or fallback to Enter.
     */
    protected async submitPrompt(): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');
        await this.page.waitForTimeout(300);

        const btn = await this.page.$(this.selectors.sendButton);
        if (btn) {
            await btn.click();
        } else {
            await this.page.keyboard.press('Enter');
        }
    }
}
