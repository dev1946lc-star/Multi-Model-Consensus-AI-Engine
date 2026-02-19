/* ──────────────────────────────────────────────
   ChatGPT Controller — chatgpt.com automation
   ────────────────────────────────────────────── */

import { BaseController } from '../base-controller';
import { SELECTORS, ModelSelectors } from '../selectors';

export class ChatGPTController extends BaseController {
    readonly modelName = 'chatgpt';
    readonly selectors: ModelSelectors = SELECTORS.chatgpt;

    /**
     * ChatGPT uses a contenteditable div as its textarea.
     * Override typePrompt to handle the ProseMirror-style editor.
     */
    protected async typePrompt(prompt: string): Promise<void> {
        if (!this.page) throw new Error('Page not initialized');

        const el = await this.page.waitForSelector(this.selectors.textarea, { timeout: 10000 });
        if (!el) throw new Error('ChatGPT textarea not found');

        await el.click();

        // Use clipboard to paste large prompts quickly
        await this.page.evaluate((text) => {
            const textarea = document.querySelector('#prompt-textarea');
            if (textarea) {
                // Focus and set content via execCommand for contenteditable
                (textarea as HTMLElement).focus();
                document.execCommand('selectAll');
                document.execCommand('delete');
                document.execCommand('insertText', false, text);
            }
        }, prompt);

        await this.page.waitForTimeout(300);
    }

    /**
     * ChatGPT response extraction — get the last assistant message.
     */
    protected async extractResponse(): Promise<string> {
        if (!this.page) throw new Error('Page not initialized');

        const elements = await this.page.$$(this.selectors.responseContainer);
        if (elements.length === 0) throw new Error('No ChatGPT response found');

        const lastEl = elements[elements.length - 1];

        // Try to get the markdown content
        const text = await lastEl.evaluate((el) => {
            // ChatGPT wraps code blocks in <pre><code> elements
            const codeBlocks = el.querySelectorAll('pre code');
            if (codeBlocks.length > 0) {
                // Reconstruct markdown with code blocks
                let result = '';
                const children = Array.from(el.children);
                for (const child of children) {
                    if (child.tagName === 'PRE') {
                        const code = child.querySelector('code');
                        const langClass = code?.className.match(/language-(\w+)/);
                        const lang = langClass ? langClass[1] : '';
                        result += `\n\`\`\`${lang}\n${code?.textContent || ''}\n\`\`\`\n`;
                    } else {
                        result += child.textContent + '\n';
                    }
                }
                return result;
            }
            return el.textContent || '';
        });

        return text.trim();
    }
}
