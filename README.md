<<<<<<< HEAD
# ChatGPT Local Copilot — Multi-Model Consensus AI Engine

A production-quality VS Code AI coding assistant that orchestrates **6 LLMs** (ChatGPT, Claude, Gemini, DeepSeek, Qwen, Kimi) via browser automation. No API keys needed — uses your existing logged-in sessions.

## Architecture

```
VS Code Extension ←→ Bridge Server (:3210) ←→ Model Orchestrator
                                                    ├── ChatGPT  (chatgpt.com)
                                                    ├── Claude   (claude.ai)
                                                    ├── Gemini   (gemini.google.com)
                                                    ├── DeepSeek (chat.deepseek.com)
                                                    ├── Qwen     (qwen.ai)
                                                    └── Kimi     (kimi.moonshot.cn)
```

### Consensus Pipeline

1. **Proposal** — All enabled models receive the same coding task in parallel
2. **Critique** — Each model reviews other proposals for bugs/improvements
3. **Scoring** — Weighted scoring (correctness 30%, completeness 25%, safety 20%, style 15%, perf 10%)
4. **Merge** — Clear winner → use directly | Close scores → merge best aspects | Conflict → ChatGPT judges

## Quick Start

### 1. Install Dependencies

```bash
npm run install-all
```

### 2. Set Up Browser Profiles

Each model needs a logged-in browser session. On first launch, the automation will open a browser — **log in manually once**, and the session is saved.

```bash
# Launch each model's browser to log in (do this once per model)
cd automation && npx ts-node src/controllers/chatgpt.ts
```

Browser profiles are stored at `~/.copilot-browsers/{model}/`.

### 3. Start the Bridge Server

```bash
npm run start-bridge
```

The server starts on `ws://127.0.0.1:3210` (localhost only).

### 4. Install the VS Code Extension

```bash
cd extension && npm run compile
```

Then in VS Code:
- Open the `extension/` folder
- Press `F5` to launch the Extension Development Host
- Or package with `vsce package` and install the `.vsix`

## Usage

### Commands

| Command | Keybinding | Description |
|---------|-----------|-------------|
| Ask AI (Multi-Model) | `Ctrl+Shift+G` | Ask a question about the current file |
| Fix with AI | Right-click menu | Fix bugs in selected code |
| Explain Code | Right-click menu | Get an explanation of selected code |
| Refactor with AI | Right-click menu | Improve code quality |
| Create File with AI | Command palette | Generate a new file from description |

### Sidebar Panel

The sidebar shows:
- Chat history with AI responses
- Quick action buttons (Ask, Fix, Explain, Refactor, Create)
- **Consensus info**: which models were used, winner model, consensus score, confidence

### Settings

In VS Code settings (`Ctrl+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `copilot.bridgePort` | `3210` | Bridge server port |
| `copilot.enabledModels` | `["chatgpt"]` | Which models to use |

Enable multiple models for consensus:
```json
{
  "copilot.enabledModels": ["chatgpt", "claude", "gemini", "deepseek"]
}
```

## Project Structure

```
/
├── extension/              VS Code extension (TypeScript)
│   ├── src/
│   │   ├── extension.ts        Entry point, command registration
│   │   ├── bridge-client.ts    WebSocket client
│   │   ├── context-collector.ts Workspace context capture
│   │   ├── patch-applier.ts    Diff preview + apply edits
│   │   └── chat-panel.ts      Sidebar webview provider
│   ├── media/
│   │   ├── chat.css            Dark-themed chat styles
│   │   └── chat.js             Webview client logic
│   └── package.json            Extension manifest
│
├── bridge/                 Local bridge server (Node.js)
│   ├── src/
│   │   ├── server.ts           WebSocket server (:3210)
│   │   ├── message-types.ts    Shared TypeScript interfaces
│   │   ├── response-parser.ts  Parse AI markdown responses
│   │   ├── patch-engine.ts     Convert responses to edits
│   │   └── orchestrator/
│   │       ├── orchestrator.ts Main dispatch + consensus runner
│   │       ├── consensus.ts    Scoring + merge algorithm
│   │       └── types.ts        Orchestrator interfaces
│   └── package.json
│
├── automation/             Playwright automation (6 models)
│   ├── src/
│   │   ├── base-controller.ts  Abstract base class
│   │   ├── selectors.ts        Centralized CSS selectors
│   │   ├── prompt-builder.ts   Prompt templates
│   │   └── controllers/
│   │       ├── chatgpt.ts
│   │       ├── claude.ts
│   │       ├── gemini.ts
│   │       ├── deepseek.ts
│   │       ├── qwen.ts
│   │       └── kimi.ts
│   └── package.json
│
├── package.json            Root workspace scripts
└── README.md               This file
```

## Security

- **Localhost only** — Bridge server binds to `127.0.0.1`, never exposed to network
- **No telemetry** — Zero data sent to external services
- **No API keys** — Uses your existing browser sessions
- **No external APIs** — Everything runs locally

## Troubleshooting

### Bridge server won't start
- Check port 3210 isn't in use: `netstat -ano | findstr 3210`
- Try a different port in VS Code settings

### Model not responding
- Open the browser profile and verify you're logged in
- Check the selectors in `automation/src/selectors.ts` — model UIs change frequently
- Increase timeout in bridge config

### Extension can't connect
- Ensure bridge server is running: `npm run start-bridge`
- Check the VS Code Output panel for errors (select "AI Copilot")

## Development

```bash
# Watch mode for all components
cd bridge && npm run dev      # Bridge
cd automation && npm run dev  # Automation
cd extension && npm run watch # Extension
```

## How It Works (Detail)

1. User selects code and clicks "Fix with AI"
2. Extension collects context (file, selection, project tree)
3. Sends request via WebSocket to bridge server
4. Bridge dispatches to all enabled model controllers in parallel
5. Each controller uses Playwright to interact with the model's web UI
6. Responses are collected and run through the consensus pipeline
7. Winning/merged response is parsed into structured edits
8. Extension shows a diff preview
9. User clicks "Apply" → WorkspaceEdit is applied
=======
# Multi-Model-Consensus-AI-Engine
>>>>>>> 082bae29dd2141ba5dca830c60431e251632695f
