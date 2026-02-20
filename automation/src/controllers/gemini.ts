import { BaseController } from "../base-controller";
import { selectors } from "../selectors";

export class GeminiController extends BaseController {
    constructor() {
        super("./profiles/gemini", "https://gemini.google.com");
    }

    async ask(prompt: string): Promise<string> {
        const box = this.page.locator(selectors.gemini.input).first();
        await box.fill(prompt);
        await box.press("Enter");

        const reply = this.page.locator(selectors.gemini.response).last();
        return this.waitForStableResponse(reply);
    }
}
