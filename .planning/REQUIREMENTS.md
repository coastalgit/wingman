# Requirements: Wingman v2

**Defined:** 2026-03-04
**Core Value:** A developer can interact with Claude Code sessions entirely from the browser — with richer UI than a terminal — without losing any interactivity (slash commands, plugin menus, confirmations).

## v1 Requirements

### PoC — Terminal Pipe

- [x] **POC-01**: `npx wingman` starts a Node.js HTTP/WebSocket server and opens a browser window automatically
- [x] **POC-02**: Browser window renders a terminal using xterm.js connected to the server via WebSocket
- [ ] **POC-03**: Server spawns Claude Code as a PTY child process (via node-pty) on startup
- [ ] **POC-04**: Claude Code stdout/stderr streams to browser terminal in real time
- [ ] **POC-05**: User input typed in browser terminal is sent to Claude Code process stdin
- [ ] **POC-06**: Slash commands (e.g. `/help`, `/plugins`) work correctly in browser terminal
- [ ] **POC-07**: Interactive prompts (plugin menus, y/n confirmations) work correctly in browser terminal
- [x] **POC-08**: ANSI colours, spinners, and formatting render correctly in browser terminal
- [x] **POC-09**: Terminal history is scrollable in browser

### Session Management

- [ ] **SESS-01**: Each `npx wingman` session has a unique ID stored in `.ai/wingman/sessions.json`
- [ ] **SESS-02**: Closing and reopening a session browser tab reconnects to the same running Claude process with full history replayed
- [ ] **SESS-03**: Server maintains a scrollback buffer per session for history replay on reconnect
- [ ] **SESS-04**: Individual session can be gracefully closed (terminates Claude child process, marks session closed)
- [ ] **SESS-05**: Session metadata visible in browser window (session ID, project name, Mission Control port)

### Mission Control

- [ ] **MC-01**: `npx wingman` opens Mission Control in browser (project-scoped launcher)
- [ ] **MC-02**: Mission Control displays all active sessions for the project
- [ ] **MC-03**: New Claude Code sessions can be launched from Mission Control (each opens in a new browser window)
- [ ] **MC-04**: Mission Control shows session status (active, closed, reconnectable)
- [ ] **MC-05**: "Exit Wingman" button in Mission Control gracefully shuts down all sessions and the server

### Process Lifecycle

- [ ] **PROC-01**: Single Wingman instance per project enforced via PID lock file (`.ai/wingman/wingman.pid`)
- [ ] **PROC-02**: Duplicate `npx wingman` launch on same project detects live instance and prints existing URL instead of starting new server
- [ ] **PROC-03**: Stale PID lock (from uncontrolled shutdown) detected and cleaned up on next launch
- [ ] **PROC-04**: Ctrl+C in terminal gracefully shuts down all child processes and cleans up lock file
- [ ] **PROC-05**: All browser windows notified on Wingman shutdown with clear "Wingman shutting down" state
- [ ] **PROC-06**: Zombie process prevention — all Claude child processes tracked and killed on server exit

### Manual Mode

- [ ] **MAN-01**: `npx wingman --manual` starts in manual mode (no Claude process spawned)
- [ ] **MAN-02**: In manual mode, session files (`cprompt.md`, `ccontext.md`) are written to `.ai/wingman/` for use via slash commands
- [ ] **MAN-03**: `/ccc` slash command readable from `.ai/wingman/ccontext.md` in active Claude Code session
- [ ] **MAN-04**: `/ccp` slash command readable from `.ai/wingman/cprompt.md` in active Claude Code session

### Distribution

- [ ] **DIST-01**: Package installable and runnable via `npx wingman` without global install
- [ ] **DIST-02**: node-pty native addon builds or uses prebuilt binaries on Windows without requiring manual build tool setup

## v2 Requirements

### Enhanced UI
- **UI-01**: Tool use approval overlays — clickable Approve/Reject buttons rendered over terminal output
- **UI-02**: Slash command autocomplete dropdown in terminal input
- **UI-03**: Plugin option menus rendered as clickable buttons rather than keyboard input
- **UI-04**: Prompt/context staging area (compose rich prompts with history, templates)

### Claw Integration
- **CLAW-01**: Claw tab in Mission Control for managing claw sessions
- **CLAW-02**: Launch claw session from Mission Control (friendly launcher)
- **CLAW-03**: Claw session output streamed to browser terminal
- **CLAW-04**: Install detection for ECC/claw with setup instructions if not found

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-project Mission Control | Each `npx wingman` is project-scoped by design |
| File System Access API approach | Superseded by Node.js server model |
| Flutter desktop app | Retired |
| Chat UI (replacing terminal) | Anti-pattern — product must be "terminal in browser", not chatbot |
| Markdown-rendered AI responses | High complexity, terminal rendering is adequate for v1 |
| Real-time collaboration | Out of scope for personal dev tool |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| POC-01 | Phase 1 | Complete |
| POC-02 | Phase 1 | Complete |
| POC-03 | Phase 1 | Pending |
| POC-04 | Phase 1 | Pending |
| POC-05 | Phase 1 | Pending |
| POC-06 | Phase 1 | Pending |
| POC-07 | Phase 1 | Pending |
| POC-08 | Phase 1 | Complete |
| POC-09 | Phase 1 | Complete |
| SESS-01 | Phase 2 | Pending |
| SESS-02 | Phase 2 | Pending |
| SESS-03 | Phase 2 | Pending |
| SESS-04 | Phase 2 | Pending |
| SESS-05 | Phase 2 | Pending |
| MC-01 | Phase 3 | Pending |
| MC-02 | Phase 3 | Pending |
| MC-03 | Phase 3 | Pending |
| MC-04 | Phase 3 | Pending |
| MC-05 | Phase 3 | Pending |
| PROC-01 | Phase 3 | Pending |
| PROC-02 | Phase 3 | Pending |
| PROC-03 | Phase 3 | Pending |
| PROC-04 | Phase 3 | Pending |
| PROC-05 | Phase 3 | Pending |
| PROC-06 | Phase 3 | Pending |
| MAN-01 | Phase 3 | Pending |
| MAN-02 | Phase 3 | Pending |
| MAN-03 | Phase 3 | Pending |
| MAN-04 | Phase 3 | Pending |
| DIST-01 | Phase 4 | Pending |
| DIST-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 after roadmap creation*
