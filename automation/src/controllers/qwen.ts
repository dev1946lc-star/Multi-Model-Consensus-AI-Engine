import { BaseController } from "../base-controller";
import { selectors } from "../selectors";

export class QwenController extends BaseController {
    constructor() {
        super("./profiles/qwen", "https://chat.qwenlm.ai");
    }

    async ask(prompt: string): Promise<string> {
        const box = this.page.locator(selectors.qwen.input).first();
        await box.fill(prompt);
        await box.press("Enter");

        const reply = this.page.locator(selectors.qwen.response).last();
        return this.waitForStableResponse(reply);
    }
}
