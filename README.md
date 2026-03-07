# Wingman

A browser-based mission control for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions. Launch, manage, and interact with multiple Claude Code instances from a single dashboard.

## Quick Start

```bash
cd your-project
npx wingman
```

This opens Mission Control in your browser. From there you can launch Claude Code sessions, each in its own browser tab with a full terminal + prompt/context editor.

## Features

- **Mission Control** — Dashboard showing all sessions with status indicators
- **Session Management** — Launch, stop, reconnect, and delete sessions
- **Prompt Composer** — Write and send prompts with history tracking
- **Context Editor** — Manage session context with templates and send history
- **CLI Flags** — Set Claude flags per-session (model, effort, permissions, etc.)
- **YOLO Mode** — `--dangerously-skip-permissions` with a red warning banner
- **Chrome Mode** — `--chrome` flag with blue indicator
- **File References** — Drag-and-drop files or browse project to get copyable paths
- **Settings** — Configure default file directory for uploads
- **Manual Mode** — `npx wingman --manual` for file-based prompt staging without PTY

## Requirements

- **Node.js** >= 18
- **Git for Windows** (provides the bash shell used to spawn Claude)
- **Claude Code CLI** installed (`claude` available in PATH)

## How It Works

Wingman spawns Claude Code processes via [node-pty](https://github.com/nickel-org/node-pty) and streams terminal I/O to the browser over WebSocket. Prompts and context are saved as markdown files (`.ai/wingman/cprompt.md`, `.ai/wingman/ccontext.md`) and injected into the Claude session via the `/ccp` and `/ccc` slash commands.

### Project Files

When you run Wingman in a directory, it creates:

```
.ai/wingman/
  wingman.json          — Config (templates, settings)
  wingman.pid           — Process lock (prevents duplicate instances)
  cprompt.md            — Active prompt file
  ccontext.md           — Active context file
  sessions/
    <session-id>.json   — Per-session data (history, flags)
```

### Slash Commands

Wingman sets up two Claude Code slash commands in `.claude/commands/`:

- `/ccp` — Reads the current prompt from `cprompt.md`
- `/ccc` — Reads the current context from `ccontext.md`

## CLI Options

```
npx wingman                  # Start normally (auto-assigns port)
npx wingman --port 3000      # Use a specific port
npx wingman --manual         # Manual mode (no PTY, file-based only)
```

## Development

```bash
git clone <repo-url>
cd wingman
npm install
npm run dev     # nodemon for auto-restart
```

## License

MIT
