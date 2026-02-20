import { BaseController } from "../base-controller";
import { selectors } from "../selectors";

export class ClaudeController extends BaseController {
    constructor() {
        super("./profiles/claude", "https://claude.ai");
    }

    async ask(prompt: string): Promise<string> {
        const box = this.page.locator(selectors.claude.input).first();
        await box.fill(prompt);
        await box.press("Enter");

        const reply = this.page.locator(selectors.claude.response).last();
        return this.waitForStableResponse(reply);
    }
}
