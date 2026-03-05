---
phase: 03-mission-control
plan: 01
status: complete
completed: 2026-03-04
commits:
  - 9cffc31: feat(03-01): add Mission Control server routing, REST API, and session status methods
  - e8418e1: feat(03-01): add Mission Control dashboard UI (HTML + CSS + JS)
  - 134b64e: fix(03-01): prompt for session name + show description instead of UUID + fix terminal height
  - 114e0bf: fix(03-01): restyle Mission Control with AstroVista theme to match existing Wingman UI
  - 4923d89: fix(03-01): buffer PTY output from spawn time so initial Claude output is not lost
  - 12ba003: fix(03-01): use absolute paths in session.html and restrict route to UUID pattern
---

# Plan 01 Summary — Mission Control Core Architecture

## What Was Built

### Two-Page Architecture
- `GET /` serves `public/mission-control.html` (dashboard)
- `GET /session/:id([0-9a-f-]{36})` serves `public/session.html` (terminal page)
- `public/index.html` was renamed to `public/session.html`
- UUID pattern restriction on the session route prevents static file interception

### REST API
- `GET /api/sessions` — returns all sessions with status via `sessionManager.getAllSessionsWithStatus()`
- `POST /api/sessions` — spawns PTY via `pty.spawn(BASH_PATH, ['-c', 'claude'], {...})`, calls `sessionManager.spawnSession()`, buffers output immediately into history
- `DELETE /api/sessions/:id` — kills PTY, marks session closed
- `POST /api/shutdown` — triggers `gracefulShutdown()`

### SessionManager Additions
- `getSessionStatus(sessionId)` — derives `'active' | 'reconnectable' | 'closed'` from in-memory state
- `getAllSessionsWithStatus()` — returns `{ id, description, createdAt, status }` array

### WebSocket Routing
- `{ type: 'mc-connect' }` — tags client as `clientType: 'mc'`, sends current session list
- `{ type: 'handshake', sessionId }` — reconnects terminal client to session, replays history
- `{ type: 'input' }` and `{ type: 'resize' }` — routed to PTY
- Null-spawn removed: sessions ONLY created via `POST /api/sessions`
- `broadcastSessionUpdate()` helper sends `session-update` to all MC clients

### Mission Control Dashboard (public/)
- `mission-control.html` — dark AstroVista theme, header with title + controls
- `mission-control.css` — dark card layout, status badges (active/reconnectable/closed), button styles
- `mission-control.js` — WebSocket client (mc-connect), session list rendering, "New Session" dialog (prompts for name), "Exit Wingman" button, Open/Close actions per card

### Graceful Shutdown
- `gracefulShutdown()` extracted from SIGINT handler
- Broadcasts `{ type: 'shutdown' }` to all WS clients
- Kills all active PTY processes
- Terminates WS connections, closes HTTP server, force-exits after 500ms

## Key Implementation Decisions
- PTY output buffered immediately via `ptyProcess.onData` at spawn time — terminal clients that connect later replay full history
- Session description shown in UI (not raw UUID) — user is prompted for a name on "New Session"
- `express.static` placed AFTER custom routes to prevent `index.html` interception
- UUID route pattern `[0-9a-f-]{36}` prevents static file paths (`.js`, `.css`) from matching the session route

## Current State of Key Files
- `server.js` — 255 lines, fully implemented per plan
- `lib/session-manager.js` — includes `getSessionStatus` and `getAllSessionsWithStatus`
- `public/mission-control.html/js/css` — fully implemented
- `public/session.html` — renamed from index.html
- `public/terminal.js` — reads session ID from URL path (`/session/:id`), handles `shutdown` and `error` messages

## What Plan 02 Needs
Plan 02 can use the existing `gracefulShutdown()` function in `server.js` — it just needs to be enhanced with:
1. PID lock acquire/release (new `lib/process-lock.js` module)
2. `process.on('exit')` fallback for lock cleanup
3. `process.on('uncaughtException')` handler
