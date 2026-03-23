# Wingman

## Overview

Wingman is a Node.js web application that serves as mission control for Claude Code sessions. It spawns Claude Code processes via node-pty, streams terminal I/O to the browser over WebSocket, and provides a dashboard for managing multiple sessions with prompt/context tooling.

## Architecture

- **Server**: Node.js 18+, Express 4, WebSocket (ws)
- **Terminal**: node-pty (ConPTY on Windows) → xterm.js in browser
- **Persistence**: File-based JSON (session data, config, prompt/context markdown)
- **Transport**: WebSocket for terminal I/O and control messages
- **UI**: Vanilla HTML/CSS/JS (no framework)

## Project Structure

```
wingman/
├── server.js                  # Express + WebSocket server (main entry)
├── bin/
│   └── wingman.js             # CLI entry point (`npx wingman`)
├── lib/
│   ├── session-manager.js     # Session lifecycle (spawn, stop, reconnect)
│   ├── process-lock.js        # PID lock — prevents duplicate instances
│   └── manual-mode.js         # File-based mode (no PTY)
├── public/
│   ├── mission-control.html   # Mission Control dashboard page
│   ├── mission-control.js     # MC client logic
│   ├── mission-control.css    # MC styling
│   ├── session.html           # Session page (terminal + UI)
│   ├── session-ui.js          # Session client logic
│   ├── session.css            # Session styling
│   ├── terminal.js            # xterm.js terminal wrapper
│   └── styles.css             # Global shared styles
├── package.json               # npm package definition
├── CLAUDE.md                  # This file — project instructions for Claude Code
└── README.md                  # User-facing documentation
```

## Runtime Files (per project, created at runtime)

```
.ai/wingman/
├── wingman.json              # Config (templates, settings)
├── wingman.pid               # Process lock file
├── cprompt.md                # Active prompt
├── ccontext.md               # Active context
└── sessions/
    └── <session-id>.json     # Per-session data (history, flags)
```

## Slash Commands (installed into user's project)

Wingman sets up two Claude Code slash commands in `.claude/commands/`:

- `/ccp` — Reads the current prompt from `cprompt.md`
- `/ccc` — Reads the current context from `ccontext.md`

## Key Dependencies

- `express` — HTTP server
- `node-pty` — Pseudo-terminal for spawning Claude Code
- `ws` — WebSocket server
- `open` — Auto-open browser on start

## Development Notes

- Entry point is `bin/wingman.js` (CLI) → `server.js` (Express app)
- Session IDs are UUIDs; session state is persisted to `.ai/wingman/sessions/`
- Process lock (`wingman.pid`) prevents duplicate server instances
- Manual mode (`--manual`) skips PTY entirely — file-based prompt staging only
- Git for Windows bash is required on Windows (used to spawn `claude`)

## /checkpoint

When the user says "/checkpoint" or asks to create a checkpoint, create a checkpoint file at `docs/checkpoints/YYYY-MM-DD-HHMM.md` containing:
1. **Session Summary** — what was discussed and decided this session
2. **Current State** — where we are in the brainstorm/design/build process
3. **Open Questions** — unresolved decisions or items pending input
4. **Next Steps** — what to do when resuming in a new chat
5. **Key Files Modified** — list of files created or changed this session
6. **Decisions Made** — concrete choices locked in (tech stack, architecture, scope, etc.)

The checkpoint must contain enough context for a fresh Claude Code session to continue seamlessly.
