/* ──────────────────────────────────────────────
   Claude Controller — claude.ai automation
   ────────────────────────────────────────────── */

import { BaseController } from '../base-controller';
import { SELECTORS, ModelSelectors } from '../selectors';

export class ClaudeController extends BaseController {
    readonly modelName = 'claude';
    readonly selectors: ModelSelectors = SELECTORS.claude;

    /**
     * Claude uses a ProseMirror contenteditable div.
     * We need to interact with it differently than a standard textarea.
     */
    protected async typePrompt(prompt: string): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const editor = await this.page.waitForSelector(this.selectors.contentEditable!, {
            timeout: 10000,
        });
        if (!editor) throw new Error('Claude editor not found');

        await editor.click();

        // Clear existing content
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Backspace');
        await this.page.waitForTimeout(200);

        // Type the prompt using keyboard.type for better compatibility
        // Split into lines to maintain formatting
        const lines = prompt.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) await this.page.keyboard.press('Shift+Enter');
            if (lines[i].length > 0) {
                await this.page.keyboard.type(lines[i], { delay: 3 });
            }
        }

        await this.page.waitForTimeout(300);
    }

    /**
     * Claude response extraction.
     */
    protected async extractResponse(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const elements = await this.page.$$(this.selectors.responseContainer);
        if (elements.length === 0) throw new Error('No Claude response found');

        const lastEl = elements[elements.length - 1];

        const text = await lastEl.evaluate((el) => {
            let result = '';
            const walk = (node: Node) => {
                if (node.nodeName === 'PRE') {
                    const elem = node as Element;
                    const code = elem.querySelector('code');
                    const langClass = code?.className?.match(/language-(\w+)/);
                    const lang = langClass ? langClass[1] : '';
                    result += `\n\`\`\`${lang}\n${code?.textContent || node.textContent || ''}\n\`\`\`\n`;
                } else if (node.nodeType === Node.TEXT_NODE) {
                    result += node.textContent;
                } else if (node.nodeName === 'P' || node.nodeName === 'DIV') {
                    result += '\n';
                    node.childNodes.forEach(walk);
                    result += '\n';
                } else {
                    node.childNodes.forEach(walk);
                }
            };
            el.childNodes.forEach(walk);
            return result;
        });

        return text.trim();
    }
}
