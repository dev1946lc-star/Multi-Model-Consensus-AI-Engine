import { BaseController } from "../base-controller";
import { selectors } from "../selectors";

export class ChatGPTController extends BaseController {
    constructor() {
        super("./profiles/chatgpt", "https://chatgpt.com");
    }

    async ask(prompt: string): Promise<string> {
        const box = this.page.locator(selectors.chatgpt.input).first();
        await box.fill(prompt);
        await box.press("Enter");

        const reply = this.page.locator(selectors.chatgpt.response).last();
        return this.waitForStableResponse(reply);
    }
}
