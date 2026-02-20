import { BaseController } from "../base-controller";
import { selectors } from "../selectors";

export class DeepSeekController extends BaseController {
    constructor() {
        super("./profiles/deepseek", "https://chat.deepseek.com");
    }

    async ask(prompt: string): Promise<string> {
        const box = this.page.locator(selectors.deepseek.input).first();
        await box.fill(prompt);
        await box.press("Enter");

        const reply = this.page.locator(selectors.deepseek.response).last();
        return this.waitForStableResponse(reply);
    }
}
