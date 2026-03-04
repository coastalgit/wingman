---
phase: 01-terminal-pipe-poc
plan: "02"
subsystem: infra
tags: [node-pty, websocket, pty, git-bash, conpty, claude-code]

# Dependency graph
requires:
  - phase: 01-01
    provides: Express + WebSocket server scaffold with ptyProcess = null placeholder and ws message protocol
provides:
  - PTY spawn wired into WebSocket bridge (node-pty + Git Bash + claude)
  - ConPTY spike validation: Git Bash + node-pty works cleanly on this system
  - WINGMAN_BASH_PATH env override for non-default Git Bash installations
  - Full PTY pipe: Claude Code output -> WebSocket -> browser, browser keystrokes -> WebSocket -> PTY stdin
affects:
  - 01-03 (prompt injection and context management build on top of this PTY pipe)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - PTY spawn pattern: pty.spawn(BASH_PATH, ['-c', 'claude'], { name: xterm-256color, cols: 120, rows: 30 })
    - dataHandler = ptyProcess.onData() pattern with dataHandler.dispose() on ws.close() for leak-free cleanup
    - ptyProcess.onExit broadcasts session-ended to all wss.clients

key-files:
  created:
    - temp/pty-spike.js
  modified:
    - server.js

key-decisions:
  - "ConPTY spike result: clean output (no garbled binary), useConpty:false NOT needed on this system"
  - "Native claude.exe (v2.1.68) works correctly with node-pty + ConPTY — no freeze bug on this version"
  - "No npm Claude Code package installed; native installer binary used directly via bash -c 'claude'"
  - "dataHandler.dispose() on ws.close() is essential to prevent PTY data listeners accumulating per reconnect"

patterns-established:
  - "PTY-to-WebSocket bridge: const dataHandler = ptyProcess.onData(cb) + ws.on('close', () => dataHandler.dispose())"
  - "ptyProcess.onExit broadcasts session-ended JSON to wss.clients (all connected browsers)"

requirements-completed:
  - POC-03
  - POC-04
  - POC-05

# Metrics
duration: 10min
completed: 2026-03-04
---

# Phase 1 Plan 02: PTY Spawn + WebSocket Bridge Summary

**node-pty spawns Claude Code via Git Bash with PTY output streamed to browser over WebSocket and browser keystrokes routed back to PTY stdin**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-04T16:32:00Z
- **Completed:** 2026-03-04T16:42:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- ConPTY spike validated: Git Bash spawns cleanly via node-pty, no garbled output, useConpty:false not needed
- server.js now spawns Claude Code via `pty.spawn(BASH_PATH, ['-c', 'claude'], ...)` replacing the null placeholder
- Full bidirectional PTY pipe wired: PTY onData -> ws.send (output to browser), ws.message -> ptyProcess.write/resize (input from browser)
- Verified native claude.exe v2.1.68 works correctly with ConPTY (no freeze bug on this system/version)

## Task Commits

1. **Task 1: ConPTY spike — validate Git Bash + node-pty interaction** - `412135c` (feat)
2. **Task 2: Wire PTY spawn and WebSocket bridge into server.js** - `322b819` (feat)

**Plan metadata:** (docs commit — pending)

## Files Created/Modified

- `server.js` - Replaced null ptyProcess with real node-pty spawn; added BASH_PATH detection; wired onData/write/resize/onExit; SIGINT handler kills PTY
- `temp/pty-spike.js` - ConPTY validation spike (runs Git Bash, echoes test string, verifies clean exit)

## Decisions Made

- **ConPTY works without useConpty: false**: The spike produced clean xterm output (ANSI sequences, not garbled binary). The `useConpty: false` workaround is documented but not applied.
- **Native claude.exe used**: Only the native installer binary is present (no npm @anthropic-ai/claude-code). Tested: native v2.1.68 produces output immediately via PTY, no freeze. The plan's freeze warning was for an earlier version.
- **dataHandler pattern**: Each WebSocket connection creates a new `ptyProcess.onData` listener via `const dataHandler = ptyProcess.onData(...)`. The `dataHandler.dispose()` call on `ws.close` is critical — without it, every reconnect accumulates a new listener on the shared PTY process, causing duplicate output.
- **module.exports removed**: The previous `module.exports = { ptyProcess }` was removed since ptyProcess is now a `const` (not `let`) and there's no downstream consumer needing the export.

## Deviations from Plan

None - plan executed exactly as written. ConPTY worked cleanly (spike result matched the "clean output" path). The native binary concern was investigated and found to be a non-issue on v2.1.68.

## Issues Encountered

- The `node -e "..."` inline verification command from the plan's `<verify>` block failed in bash due to shell escaping of `!` in `if (!src.includes(...))`. Used a temp verification script file (`temp/verify-01-02.js`) instead. Not a code issue.
- Native claude.exe warning in plan: investigated and found not to be a problem. The binary produces immediate PTY output. Documented in server.js header comment.

## User Setup Required

None - Git Bash at default path (`C:\Program Files\Git\bin\bash.exe`) is detected automatically. Set `WINGMAN_BASH_PATH` env var if your Git Bash is at a non-default location.

**Important:** Running `node server.js` will spawn Claude Code immediately on startup. Do not run from inside an active Claude Code session (the `CLAUDECODE` env var will cause Claude to refuse to start nested).

## Next Phase Readiness

- PTY pipe is fully operational: `node server.js` streams Claude Code output to browser terminal
- User can type in browser terminal and Claude Code receives and responds
- Terminal resize propagates from browser to PTY (cols/rows)
- Plan 03 (prompt injection, context file piping) can proceed immediately

## Self-Check: PASSED

All files verified present on disk. Both task commits verified in git log (412135c, 322b819).

---
*Phase: 01-terminal-pipe-poc*
*Completed: 2026-03-04*
