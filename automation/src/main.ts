import {
  ChatGPTController,
  ClaudeController,
  GeminiController,
  DeepSeekController,
  QwenController,
  KimiController,
} from "./index";

async function start() {
  console.log("Starting automation controllers...");

  const controllers = [
    new ChatGPTController(),
    new ClaudeController(),
    new GeminiController(),
    new DeepSeekController(),
    new QwenController(),
    new KimiController(),
  ];

  await Promise.all(
    controllers.map((c) =>
      c.launch().then(() => console.log(`${c.constructor.name} ready`))
    )
  );

  console.log("All models ready");

  await new Promise(() => {}); // keep alive
}

start().catch((err) => {
  console.error("Automation failed:", err);
  process.exit(1);
});