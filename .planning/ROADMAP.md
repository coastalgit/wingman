# Roadmap: Wingman v2

## Overview

Wingman v2 replaces the Flutter desktop app with a Node.js web UI for Claude Code terminal sessions. The roadmap validates the core PTY-to-browser pipe first (Phase 1), then layers session management (Phase 2), multi-session orchestration with Mission Control and process lifecycle (Phase 3), and finally npx distribution packaging (Phase 4). Each phase delivers a coherent, testable capability that builds on the previous.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Terminal Pipe PoC** - Prove browser-to-Claude PTY pipe works end-to-end on Windows/WSL
- [ ] **Phase 2: Session Management** - Multiple sessions with reconnection, history replay, and graceful lifecycle
- [ ] **Phase 3: Mission Control** - Project-scoped launcher, process lifecycle enforcement, and manual mode fallback
- [ ] **Phase 4: Distribution** - npx-installable package with native addon support

## Phase Details

### Phase 1: Terminal Pipe PoC
**Goal**: A developer can launch Wingman, see a Claude Code session in the browser, and interact with it exactly as they would in a terminal
**Depends on**: Nothing (first phase)
**Requirements**: POC-01, POC-02, POC-03, POC-04, POC-05, POC-06, POC-07, POC-08, POC-09
**Success Criteria** (what must be TRUE):
  1. Running `node server.js` starts a server and opens a browser window with a terminal UI
  2. Claude Code output streams into the browser terminal in real time with correct ANSI rendering (colours, spinners, formatting)
  3. User can type text and slash commands in the browser terminal and Claude Code receives and responds to them
  4. Interactive prompts (y/n confirmations, plugin menus) work correctly through the browser terminal
  5. Terminal history is scrollable in the browser window
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Scaffold: package.json, server.js (HTTP+WS), public/ with xterm.js terminal UI
- [ ] 01-02-PLAN.md — PTY wiring: ConPTY spike + Claude Code spawn via Git Bash + WebSocket bridge
- [ ] 01-03-PLAN.md — Human verification: interactive test of all 9 POC requirements

### Phase 2: Session Management
**Goal**: A developer can run multiple Claude Code sessions, close browser tabs, reopen them, and reconnect to running sessions without losing history
**Depends on**: Phase 1
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05
**Success Criteria** (what must be TRUE):
  1. Each session has a unique ID persisted in `.ai/wingman/sessions.json`
  2. Closing a browser tab and reopening the session URL reconnects to the same Claude process with full terminal history replayed
  3. A session can be gracefully closed, which terminates its Claude child process and marks it as closed
  4. Session metadata (session ID, project name, port) is visible in the browser window
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Mission Control
**Goal**: A developer manages all Claude Code sessions from a central launcher, with robust process lifecycle guarantees and a manual-mode fallback
**Depends on**: Phase 2
**Requirements**: MC-01, MC-02, MC-03, MC-04, MC-05, PROC-01, PROC-02, PROC-03, PROC-04, PROC-05, PROC-06, MAN-01, MAN-02, MAN-03, MAN-04
**Success Criteria** (what must be TRUE):
  1. `npx wingman` opens Mission Control in the browser showing all active sessions with their status (active, closed, reconnectable)
  2. New Claude Code sessions can be launched from Mission Control, each opening in its own browser window
  3. Only one Wingman instance runs per project (duplicate launch prints existing URL); stale PID locks are auto-cleaned
  4. "Exit Wingman" button and Ctrl+C both gracefully shut down all sessions, clean up child processes, and remove the lock file
  5. `npx wingman --manual` starts without spawning Claude processes; session files (`cprompt.md`, `ccontext.md`) are written to `.ai/wingman/` for use via `/ccc` and `/ccp` slash commands
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Distribution
**Goal**: Any developer can run `npx wingman` in a project directory and it just works, with no manual build tool setup
**Depends on**: Phase 3
**Requirements**: DIST-01, DIST-02
**Success Criteria** (what must be TRUE):
  1. `npx wingman` installs and runs the package without requiring a global install or manual native build setup
  2. node-pty native addon resolves correctly on Windows (prebuilt binaries or transparent compilation)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Terminal Pipe PoC | 1/3 | In Progress|  |
| 2. Session Management | 0/2 | Not started | - |
| 3. Mission Control | 0/3 | Not started | - |
| 4. Distribution | 0/1 | Not started | - |
