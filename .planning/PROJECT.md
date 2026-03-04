# Wingman v2

## What This Is

Wingman is a Node.js-based web UI for Claude Code terminal sessions. Run `npx wingman` once in a project directory — it starts a local server, spawns and manages Claude Code processes under the hood, and surfaces them as interactive browser windows. The terminal just hosts the server; all Claude interaction happens in the browser.

## Core Value

A developer can open, interact with, and manage Claude Code sessions entirely from the browser — with richer UI than a terminal — without losing any of the interactivity (slash commands, plugin menus, confirmations) they'd have in a normal terminal session.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**PoC (Phase 1)**
- [ ] `npx wingman` starts a Node.js server and opens a browser window
- [ ] Browser window spawns a single Claude Code session and streams its output
- [ ] User can type input and send it to the running Claude process (slash commands, responses, etc.)
- [ ] Full terminal history visible and scrollable in the browser

**Core (subsequent phases)**
- [ ] Single Wingman instance per project (PID lock file, detects duplicate launches)
- [ ] Mission Control window — project-scoped launcher for all sessions
- [ ] Sessions launched from Mission Control, each opens in its own browser window
- [ ] Session reconnection — closing/reopening a session browser tab reconnects to same session with full history
- [ ] Graceful session close (terminates Claude child process cleanly)
- [ ] Graceful Wingman exit — from Mission Control UI and Ctrl+C in terminal (cleans up all child processes, lock file, session registry)
- [ ] Accidental kill recovery — stale PID detected on next launch, auto-cleanup
- [ ] Session metadata visible in each browser window (Mission Control port, session ID, project)
- [ ] Manual mode (`--manual` flag) — static slash command approach, `/ccc` and `/ccp` read from `.ai/wingman/` files in active Claude Code session

**File structure**
- [ ] Project files stored under `.ai/wingman/` (replaces old `wingman/` + `docs/` structure)
- [ ] Session scoped cache files: `cprompt.md`, `ccontext.md` per session

### Out of Scope

- Claw integration — defer until core Wingman is stable
- Multi-project Mission Control — each `npx wingman` is scoped to its project
- File System Access API approach — superseded by Node.js server model
- Flutter desktop app — retired

## Context

- Wingman v1 was a Flutter Windows desktop app built at the April 2025 Aspire Hackathon — used as a prompt/context staging area, files read via shell aliases (`ccc`, `ccp`)
- v2 replaces Flutter entirely with a web UI served by a Node.js process
- Existing testbed in `testbed/public/` — polished HTML/CSS/JS UI with mock data, can be used as visual starting point
- The PoC goal is to validate the core pipe: browser ↔ Node server ↔ Claude Code process
- Sub-agent execution approach to be used during build phases (learning exercise)

## Constraints

- **Runtime**: Node.js — required for process spawning and WebSocket server
- **Distribution**: `npx wingman` — no global install required
- **Scope**: Single project per Wingman instance — Mission Control is project-locked
- **Platform**: Windows primary target (developer uses Windows + WSL for Claude Code CLI)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Node.js server (not static files) | Required for process spawning — automated mode needs to own Claude child processes | — Pending |
| Automated mode default, `--manual` optional | Most value comes from owning the process; manual is fallback | — Pending |
| PoC before full build | Validate browser ↔ Claude pipe works before investing in session management | — Pending |
| Claw deferred | Focus on core Wingman first; claw integration adds complexity | — Pending |
| One Wingman instance per project | Prevents conflicting process ownership; duplicate launch detects and redirects | — Pending |
| Session reconnection via server-buffered history | Closing browser tab shouldn't lose session; server holds state | — Pending |

---
*Last updated: 2026-03-04 after initialization*
