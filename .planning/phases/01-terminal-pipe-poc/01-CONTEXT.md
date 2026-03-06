# Phase 1: Terminal Pipe PoC - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning
**Source:** User correction during plan-phase

<domain>
## Phase Boundary

Build a working proof-of-concept: `node server.js` starts a Node.js server, opens a browser window, spawns Claude Code via node-pty in a Windows shell, and streams the PTY output to xterm.js in the browser. User can type into the browser terminal and interact with Claude Code exactly as they would in a native terminal.

</domain>

<decisions>
## Implementation Decisions

### Abandoned: .ai/ directory structure
The previously planned `.ai/wingman/` session registry / PID lock file approach is **abandoned** for Phase 1. This PoC works directly with Claude Code terminal emulation — no file-based session registry, no `.ai/` directory.

### Target: Direct Claude Code terminal emulation
Phase 1 is purely about getting a PTY connected to `claude` (running natively in Windows PowerShell/cmd/bash) and streaming it to a browser xterm.js instance. No session management, no file I/O layer.

### No WSL
Claude Code runs natively in a Windows shell (PowerShell or bash). No `wsl.exe` invocation needed — node-pty spawns `claude` directly.

### Claude's Discretion
- Exact shell to spawn (cmd vs PowerShell vs bash) — use whatever works best with node-pty on Windows
- WebSocket library choice (ws is the established default)
- Express vs raw http.createServer
- xterm.js version and addons (FitAddon, WebLinksAddon are standard)
- Port number (7891 suggested)
- Whether to use node-pty prebuilt binaries or build from source

</decisions>

<specifics>
## Specific Ideas

- Phase goal: developer runs `node server.js`, browser opens, Claude Code appears in browser terminal, full interaction works
- PTY is mandatory — Claude Code detects TTY, plain spawn breaks slash commands/spinners/colours
- xterm.js for browser-side terminal rendering (same as VS Code terminal)
- WebSocket to bridge PTY output → browser and browser keystrokes → PTY
- Phase 1 is PoC only — `node server.js` not `npx wingman` (distribution is Phase 4)

</specifics>

<deferred>
## Deferred Ideas

- `.ai/wingman/` session registry — abandoned entirely
- PID lock file — deferred/abandoned
- Multi-session / Mission Control — Phase 3
- Manual mode (`--manual` flag) — Phase 3
- `npx wingman` distribution — Phase 4
- Claw integration — post-v1

</deferred>

---

*Phase: 01-terminal-pipe-poc*
*Context gathered: 2026-03-04 via user correction during plan-phase*
