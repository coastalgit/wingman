# Roadmap: Wingman v2

## Overview

Wingman v2 replaces the Flutter desktop app with a Node.js web UI for Claude Code terminal sessions. Phases 1-4 built the terminal pipe, session management, Mission Control, and distribution. Phase 5 brings back the original Wingman session UI (prompt composer, context editor, history) from the web demo (commit 84f042b), with the xterm.js terminal embedded in the bottom third.

## Phases

- [x] **Phase 1: Terminal Pipe PoC** - Prove browser-to-Claude PTY pipe works end-to-end on Windows/WSL
- [x] **Phase 2: Session Management** - Multiple sessions with reconnection, history replay, and graceful lifecycle
- [x] **Phase 3: Mission Control** - Project-scoped launcher, process lifecycle enforcement, and manual mode fallback
- [x] **Phase 4: Distribution** - npx-installable package with native addon support
- [ ] **Phase 5: Session UI** - Restore the original Wingman session page (context/prompt/history) with embedded terminal

## Phase Details

### Phase 1-4: Complete
See previous roadmap entries. All done.

### Phase 5: Session UI with Prompt & Context
**Goal**: The session page looks like the original Wingman web UI (commit 84f042b) — context tab with editor+preview, prompts tab with history+compose — but with no session sidebar and with the xterm.js terminal in the bottom third. Save prompt → file to disk → `/ccp` auto-injected. Save context → file to disk → `/ccc` auto-injected.
**Depends on**: Phase 4
**Requirements**: SP-01..05, CTX-01..07, PMT-01..10, FILE-01..03, API-01..05
**Success Criteria** (what must be TRUE):
  1. Session page has the original two-tab layout (Session Context / Prompts) with terminal in the bottom third
  2. Context tab: editor + live markdown preview, "Save context" writes to disk and injects `/ccc` into terminal
  3. Prompts tab: history list on left, compose editor on right, "Save prompt" writes to disk and injects `/ccp` into terminal
  4. Clicking a history entry loads it into the compose editor
  5. All data (prompt, context, history) persists across tab close, reconnect, and server restart
**Plans**: 3 plans

Plans:
- [ ] 05-01-PLAN.md — Backend: per-session file storage, REST API endpoints, SessionManager extensions
- [ ] 05-02-PLAN.md — Frontend: restore original session UI layout with embedded terminal
- [ ] 05-03-PLAN.md — Integration: wire Save buttons to API, auto-inject `/ccp` and `/ccc` into PTY, verify end-to-end

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Terminal Pipe PoC | 3/3 | Complete | 2026-03-04 |
| 2. Session Management | 2/2 | Complete | 2026-03-04 |
| 3. Mission Control | 3/3 | Complete | 2026-03-05 |
| 4. Distribution | 1/1 | Complete | 2026-03-05 |
| 5. Session UI | 0/3 | Pending | — |
