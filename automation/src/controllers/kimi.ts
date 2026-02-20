import { BaseController } from "../base-controller";
import { selectors } from "../selectors";

export class KimiController extends BaseController {
    constructor() {
        super("./profiles/kimi", "https://kimi.moonshot.cn");
    }

    async ask(prompt: string): Promise<string> {
        const box = this.page.locator(selectors.kimi.input).first();
        await box.fill(prompt);
        await box.press("Enter");

        const reply = this.page.locator(selectors.kimi.response).last();
        return this.waitForStableResponse(reply);
    }
}
