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

    protected async waitForStableResponse(locator: any) {
        await locator.waitFor({ timeout: this.timeoutMs });
        return locator.innerText();
    }

    abstract ask(prompt: string): Promise<string>;

    async close() {
        await this.context?.close();
    }
}
