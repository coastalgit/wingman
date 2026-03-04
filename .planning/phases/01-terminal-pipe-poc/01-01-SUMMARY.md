---
phase: 01-terminal-pipe-poc
plan: "01"
subsystem: infra
tags: [node-pty, express, ws, xterm.js, websocket, terminal]

# Dependency graph
requires: []
provides:
  - Express + WebSocket server on port 7891 with browser auto-open
  - xterm.js browser terminal UI (CDN, no bundler) with scrollback 10000
  - PTY placeholder ready for Plan 02 to assign node-pty process
  - WebSocket message protocol (input/resize/output/session-ended)
affects:
  - 01-02 (PTY spawn wires into this scaffold)
  - 01-03 (Claude Code pipe feeds into this terminal)

# Tech tracking
tech-stack:
  added:
    - express 4.x (HTTP server + static file serving)
    - ws 8.x (WebSocket server)
    - node-pty 1.1.0 (native Windows build succeeded on Node 20)
    - open 10.x (ESM-only, browser auto-open via dynamic import)
    - xterm.js 6.0.0 + addon-fit 0.11.0 + addon-web-links 0.11.0 (CDN)
  patterns:
    - CommonJS (require) for server.js — required for node-pty CJS compatibility
    - Dynamic import() for ESM-only packages in CJS context (open v10)
    - CDN-loaded xterm.js with FitAddon.FitAddon / WebLinksAddon.WebLinksAddon global namespacing

key-files:
  created:
    - package.json
    - server.js
    - public/index.html
    - public/terminal.js
    - public/styles.css
  modified:
    - .gitignore (added node_modules/ exclusion)

key-decisions:
  - "node-pty native build: succeeded on Node 20 / Windows without prebuilt fallback"
  - "open v10 is ESM-only: use dynamic import() inside server.listen callback instead of require()"
  - "CommonJS throughout server.js: required for node-pty CJS compatibility"
  - "xterm.js via CDN (no bundler): CDN globals use FitAddon.FitAddon not FitAddon directly"

patterns-established:
  - "WebSocket message protocol: { type: input/resize/output/session-ended, data/cols/rows }"
  - "PTY placeholder pattern: let ptyProcess = null at module scope, Plan 02 assigns"
  - "ResizeObserver debounced 50ms for terminal resize propagation"

requirements-completed:
  - POC-01
  - POC-02
  - POC-08
  - POC-09

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 1 Plan 01: Project Scaffold Summary

**Node.js Express + WebSocket server on port 7891 with xterm.js browser terminal, node-pty native build, and PTY placeholder ready for session attachment**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-04T16:25:43Z
- **Completed:** 2026-03-04T16:28:52Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- node-pty 1.1.0 compiled natively on Node 20 / Windows — no prebuilt fallback required
- Express server serves public/ static files and auto-opens browser via dynamic ESM import of open v10
- xterm.js 6.0.0 terminal with full-height dark UI, blinking cursor, scrollback 10000, and WebSocket message protocol wired

## Task Commits

1. **Task 1: Create package.json and install dependencies** - `3f9ccb5` (chore)
2. **Task 2: Create server.js HTTP + WebSocket scaffold** - `fe26baf` (feat)
3. **Task 3: Create public/index.html, terminal.js, styles.css** - `bcce866` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `package.json` - Node.js project manifest with express, node-pty, open, ws, nodemon
- `server.js` - Express + WebSocket server; serves public/; auto-opens browser; PTY placeholder
- `public/index.html` - Browser page loading xterm.js 6.0.0 from CDN
- `public/terminal.js` - xterm.js init, FitAddon, WebLinksAddon, WebSocket wiring, resize observer
- `public/styles.css` - Full-height dark terminal container (#0d1117 background)
- `.gitignore` - Added node_modules/ exclusion

## Decisions Made

- **node-pty native build succeeded**: Node 20 / Windows compiled node-pty 1.1.0 without errors. The prebuilt fallback (`@homebridge/node-pty-prebuilt-multiarch`) was not needed.
- **open v10 ESM compatibility**: `open` v10 is ESM-only and cannot be `require()`d. Used `import('open').then(...)` inside the `server.listen` callback. This is the correct CJS interop pattern.
- **CommonJS throughout**: server.js uses CommonJS (`require`) because node-pty is a CJS native module. Mixing ESM would require `.mjs` extension or `"type": "module"` in package.json, which conflicts.
- **CDN global namespacing**: xterm.js CDN exposes `FitAddon.FitAddon()` and `WebLinksAddon.WebLinksAddon()` (namespace.Class pattern), not bare `FitAddon()`. Using wrong namespace causes silent runtime failure.

## Deviations from Plan

None - plan executed exactly as written. node-pty compiled natively (no fallback needed), and the ESM/CJS interop for `open` v10 was pre-documented in the plan's implementation notes.

## Issues Encountered

None. The `!` character in bash inline `node -e "..."` verification commands caused shell escaping issues — used a temporary verification script file (`temp/verify-01-01.js`) instead. Not a code issue.

## User Setup Required

None - no external service configuration required. Run `node server.js` to start.

## Next Phase Readiness

- Server scaffold and browser terminal UI are complete and operational
- `ptyProcess = null` placeholder in server.js is ready for Plan 02 to assign a node-pty spawn
- WebSocket message protocol (input/resize/output/session-ended) is implemented on both ends
- Plan 02 (PTY spawn + shell attach) can proceed immediately

## Self-Check: PASSED

All 6 created/modified files verified present on disk. All 3 task commits verified in git log.

---
*Phase: 01-terminal-pipe-poc*
*Completed: 2026-03-04*
