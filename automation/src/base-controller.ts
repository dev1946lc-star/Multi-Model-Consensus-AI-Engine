import { chromium, BrowserContext, Page } from "playwright";

export abstract class BaseController {
    protected context!: BrowserContext;
    protected page!: Page;

    constructor(
        private profileDir: string,
        private url: string,
        private timeoutMs = 120000
    ) { }

    async launch() {
        this.context = await chromium.launchPersistentContext(this.profileDir, {
            headless: false,
        });

        this.page = await this.context.newPage();
        await this.page.goto(this.url);
    }

    protected async waitForStableResponse(locator: any, ms = 1500) {
        await locator.waitFor({ timeout: this.timeoutMs });
        let last = "";
        let stable = 0;

        while (stable < ms) {
            const txt = await locator.innerText();
            if (txt === last) stable += 200;
            else stable = 0;

            last = txt;
            await new Promise(r => setTimeout(r, 200));
        }

        return last;
    }

    abstract ask(prompt: string): Promise<string>;

    async close() {
        await this.context?.close();
    }
}
