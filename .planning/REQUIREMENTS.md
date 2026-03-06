# Requirements: Wingman v2

**Defined:** 2026-03-04
**Core Value:** A developer can interact with Claude Code sessions entirely from the browser — with richer UI than a terminal — without losing any interactivity (slash commands, plugin menus, confirmations).

## v1 Requirements (Phases 1-4) — COMPLETE

### PoC — Terminal Pipe

- [x] **POC-01**: `npx wingman` starts a Node.js HTTP/WebSocket server and opens a browser window automatically
- [x] **POC-02**: Browser window renders a terminal using xterm.js connected to the server via WebSocket
- [x] **POC-03**: Server spawns Claude Code as a PTY child process (via node-pty) on startup
- [x] **POC-04**: Claude Code stdout/stderr streams to browser terminal in real time
- [x] **POC-05**: User input typed in browser terminal is sent to Claude Code process stdin
- [x] **POC-06**: Slash commands (e.g. `/help`, `/plugins`) work correctly in browser terminal
- [x] **POC-07**: Interactive prompts (plugin menus, y/n confirmations) work correctly in browser terminal
- [x] **POC-08**: ANSI colours, spinners, and formatting render correctly in browser terminal
- [x] **POC-09**: Terminal history is scrollable in browser

### Session Management

- [x] **SESS-01**: Each session has a unique ID stored in `.ai/wingman/sessions.json`
- [x] **SESS-02**: Closing and reopening a session browser tab reconnects to the same running Claude process with full history replayed
- [x] **SESS-03**: Server maintains a scrollback buffer per session for history replay on reconnect
- [x] **SESS-04**: Individual session can be stopped (kills PTY) and restarted (spawns fresh PTY)
- [x] **SESS-05**: Session metadata visible in browser window (description, created date)

### Mission Control

- [x] **MC-01**: `npx wingman` opens Mission Control in browser (project-scoped launcher)
- [x] **MC-02**: Mission Control displays all active sessions for the project
- [x] **MC-03**: New Claude Code sessions can be launched from Mission Control (each opens in a new browser window)
- [x] **MC-04**: Mission Control shows session status (active/stopped) with real-time WebSocket updates
- [x] **MC-05**: "Exit Wingman" button in Mission Control gracefully shuts down all sessions and the server

### Process Lifecycle

- [x] **PROC-01**: Single Wingman instance per project enforced via PID lock file
- [x] **PROC-02**: Duplicate launch detects live instance and prints existing URL
- [x] **PROC-03**: Stale PID lock detected and cleaned up on next launch
- [x] **PROC-04**: Ctrl+C gracefully shuts down all child processes and cleans up lock file
- [x] **PROC-05**: All browser windows notified on shutdown with "Wingman ended"state
- [x] **PROC-06**: Zombie process prevention — all Claude child processes tracked and killed on exit

### Distribution

- [x] **DIST-01**: Package runnable via `npx wingman` without global install
- [x] **DIST-02**: node-pty native addon builds on Windows without manual build tool setup
- [x] **DIST-03**: Auto-port assignment so multiple instances in different directories coexist
- [x] **DIST-04**: Git Bash auto-detection across common Windows install paths

## v2 Requirements — Session UI with Prompt & Context (Phase 5)

The original Wingman v1 web UI demo (commit 84f042b) had a full session screen with context editor, prompt composer, and prompt history. Phase 5 brings that UI back as the session page — no sidebar (sessions live on Mission Control) — with the xterm.js terminal embedded in the bottom third.

### Session Page Layout

- [ ] **SP-01**: Session page uses the original Wingman web UI layout: header with [Session Context | Prompts] tab nav, main content area, status bar
- [ ] **SP-02**: No session sidebar — session list lives on Mission Control only
- [ ] **SP-03**: Terminal (xterm.js) occupies the bottom third of the main content area, always visible regardless of active tab
- [ ] **SP-04**: Session description shown in header (as the original UI showed session name)
- [ ] **SP-05**: Resizable split between editor area (top 2/3) and terminal (bottom 1/3) — stretch goal: drag handle

### Context Tab

- [ ] **CTX-01**: Context tab has a split pane: Editor (left) and Preview (right), exactly as the original UI
- [ ] **CTX-02**: Editor is a monospace textarea for markdown editing
- [ ] **CTX-03**: Preview renders markdown in real time (using marked.js as original)
- [ ] **CTX-04**: "Save context" button writes content to the session's `ccontext.md` file on disk
- [ ] **CTX-05**: After saving, `/ccc` is auto-injected into the terminal PTY (no typing required)
- [ ] **CTX-06**: Context loads from disk on page open (persists across tab close/reopen and server restart)
- [ ] **CTX-07**: Character count and token estimate shown in toolbar (as original)

### Prompts Tab

- [ ] **PMT-01**: Prompts tab has a split pane: History list (left) and Compose editor (right), exactly as the original UI
- [ ] **PMT-02**: Compose editor is a monospace textarea with char count and token estimate
- [ ] **PMT-03**: "Save prompt" button writes content to the session's `cprompt.md` file on disk
- [ ] **PMT-04**: After saving, `/ccp` is auto-injected into the terminal PTY (no typing required)
- [ ] **PMT-05**: After saving, the prompt is appended to the session's prompt history
- [ ] **PMT-06**: "Clear" button resets the compose textarea
- [ ] **PMT-07**: History list shows all previous prompts for this session (newest first), with first line preview and timestamp
- [ ] **PMT-08**: Clicking a history entry loads its full text into the compose editor for reuse/editing
- [ ] **PMT-09**: History search/filter input (as original UI)
- [ ] **PMT-10**: Prompt history persists across server restarts (stored on disk per session)

### File Layout

- [ ] **FILE-01**: Per-session files at `.ai/wingman/sessions/<session-id>/cprompt.md`, `ccontext.md`, `history.json`
- [ ] **FILE-02**: Session directory created automatically when session is spawned
- [ ] **FILE-03**: `history.json` is an array of `{ id, text, timestamp, tokens }` objects

### API

- [ ] **API-01**: `GET /api/sessions/:id/prompt` — current prompt text
- [ ] **API-02**: `POST /api/sessions/:id/prompt` — save prompt, append to history, inject `/ccp` into PTY
- [ ] **API-03**: `GET /api/sessions/:id/context` — current context text
- [ ] **API-04**: `POST /api/sessions/:id/context` — save context, inject `/ccc` into PTY
- [ ] **API-05**: `GET /api/sessions/:id/history` — prompt history array

## Future Considerations (not scoped)

| Feature | Notes |
|---------|-------|
| Manual mode slash commands | `/ccc` and `/ccp` as Claude Code custom slash commands — only relevant in manual mode (no terminal) |
| Claw/ECC integration | Claw tab in Mission Control |
| Tool approval overlays | Clickable approve/reject over terminal output |
| Slash command autocomplete | Dropdown in terminal input |
| npm publish | Package naming, scoping |

## Out of Scope

| Feature | Reason |
|---------|--------|
| File System Access API approach | Superseded by Node.js server model |
| Flutter desktop app | Retired |
| Chat UI (replacing terminal) | Anti-pattern — product must be "terminal in browser", not chatbot |
| Markdown-rendered AI responses | Terminal rendering is adequate |
| Real-time collaboration | Out of scope for personal dev tool |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| POC-01..09 | Phase 1 | Complete |
| SESS-01..05 | Phase 2 | Complete |
| MC-01..05 | Phase 3 | Complete |
| PROC-01..06 | Phase 3 | Complete |
| DIST-01..04 | Phase 4 | Complete |
| SP-01..05 | Phase 5 | Pending |
| CTX-01..07 | Phase 5 | Pending |
| PMT-01..10 | Phase 5 | Pending |
| FILE-01..03 | Phase 5 | Pending |
| API-01..05 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 29 total — all complete
- v2 requirements (Phase 5): 30 total — all pending
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-05 — v1 marked complete, Phase 5 requirements: session UI with prompt/context management*
