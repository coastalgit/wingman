# Wingman

A browser-based mission control for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions. Launch, manage, and interact with multiple Claude Code instances from a single dashboard.

> **Origin:** Wingman started as a Flutter Windows desktop app built at a corporate hackathon. It was rewritten as a Node.js web application to be cross-platform and easier to distribute.

## Quick Start

```bash
# Install globally from GitHub
npm install -g git+https://github.com/coastalgit/wingman.git

# Then from any project directory:
cd your-project
wingman
```

This opens **Mission Control** in your browser. From there you can launch Claude Code sessions, each in its own browser tab with a full terminal.

## Features

- **Mission Control** — Dashboard showing all sessions with live status indicators
- **Session Management** — Launch, stop, reconnect, and delete sessions
- **Prompt Composer** — Write and send prompts with history tracking
- **Context Editor** — Manage session context with templates and send history
- **CLI Flags** — Set Claude flags per-session (model, effort, permissions, etc.)
- **YOLO Mode** — `--dangerously-skip-permissions` with a red warning banner
- **Chrome Mode** — `--chrome` flag with blue indicator
- **File References** — Drag-and-drop files or browse project to get copyable paths
- **Settings** — Configure default file directory for uploads

## Requirements

- **Node.js** >= 18
- **Git for Windows** (provides the bash shell used to spawn Claude)
- **Claude Code CLI** installed (`claude` available in PATH)

## How It Works

Wingman spawns Claude Code processes via [node-pty](https://github.com/nickel-org/node-pty) (using ConPTY on Windows) and streams terminal I/O to the browser over WebSocket. Prompts and context are saved as markdown files and injected into the Claude session via `/ccp` and `/ccc` slash commands.

## Project Structure

### Active source files (Node.js web app)

```
wingman/
├── server.js                  # Express + WebSocket server (main entry)
├── bin/
│   └── wingman.js             # CLI entry point (`npx wingman`)
├── lib/
│   ├── session-manager.js     # Session lifecycle (spawn, stop, reconnect)
│   └── process-lock.js        # PID lock — prevents duplicate instances
├── public/
│   ├── mission-control.html   # Mission Control dashboard page
│   ├── mission-control.js     # MC client logic
│   ├── mission-control.css    # MC styling
│   ├── session.html           # Session page (terminal + UI)
│   ├── session-ui.js          # Session client logic
│   ├── session.css            # Session styling
│   ├── terminal.js            # xterm.js terminal wrapper
│   └── styles.css             # Global shared styles
├── package.json               # v2.0.0 — npm package definition
├── CLAUDE.md                  # Project instructions for Claude Code
└── README.md                  # This file
```

### Runtime files (created per-project)

When you run Wingman in a project directory, it creates:

```
.ai/wingman/
├── wingman.json              # Config (templates, settings)
├── wingman.pid               # Process lock file
├── cprompt.md                # Active prompt
├── ccontext.md               # Active context
└── sessions/
    └── <session-id>.json     # Per-session data (history, flags)
```

### Slash commands (created in your project)

Wingman sets up two Claude Code slash commands in `.claude/commands/`:

- `/ccp` — Reads the current prompt from `cprompt.md`
- `/ccc` — Reads the current context from `ccontext.md`

## CLI Options

```
wingman                      # Start normally (auto-assigns port)
wingman --port 3000          # Use a specific port
```

## Installation

### From npm (via GitHub)

```bash
# Global install directly from GitHub
npm install -g git+https://github.com/coastalgit/wingman.git

# Then from any project directory:
wingman
```

### From source

```bash
git clone https://github.com/coastalgit/wingman.git
cd wingman
npm install
npm run dev       # nodemon for auto-restart during development
npm start         # production start
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 18+, Express 4 |
| Terminal | node-pty (ConPTY on Windows) |
| Real-time | WebSocket (ws) |
| Browser terminal | xterm.js 6.0 |
| Package manager | npm |

## License

MIT
