---
phase: 03-mission-control
plan: 02
status: complete
completed: 2026-03-05
---

# Plan 02 Summary — Process Lifecycle (PID Lock)

## What Was Built

### lib/process-lock.js (new)
- `acquireLock(lockPath, port)`: checks for existing lock, exits with URL if live process found, cleans stale locks, writes `{ pid, port }` JSON
- `releaseLock(lockPath)`: silently removes lock file

### server.js changes
- Added `require('./lib/process-lock.js')` and lock path at `.ai/wingman/wingman.pid`
- `acquireLock(lockPath, PORT)` called before session manager init
- `gracefulShutdown()` enhanced with `shuttingDown` guard (prevents double-invocation) and `releaseLock()` call
- `process.on('exit')` fallback calls `releaseLock()` (sync safety net)
- `process.on('uncaughtException')` logs error and calls `gracefulShutdown()`

## Verification
- Lock created on start, duplicate launch prints existing URL and exits
- Stale locks auto-cleaned on next start
- Lock released on Ctrl+C, Exit Wingman, and crashes
