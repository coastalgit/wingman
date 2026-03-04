---
status: testing
phase: 01-terminal-pipe-poc
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-03-04T00:00:00Z
updated: 2026-03-04T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 4
name: Browser Keystrokes Reach Claude Code
expected: |
  Type a message in the browser terminal and press Enter — Claude Code
  receives it and responds. Input is not echoed locally (PTY handles echo).
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: From the REPO ROOT (D:\AI\...\wingman\), run `node server.js`. Server prints "Wingman running at http://localhost:7891", browser auto-opens, Claude Code spawns — startup output visible in browser terminal.
result: pass

### 2. Browser Terminal Renders
expected: Dark full-height terminal UI (#0d1117 background) with blinking cursor. xterm.js fills the entire viewport — no blank/white page, no layout issues.
result: pass

### 3. Claude Code Output Streams to Browser
expected: Claude Code's startup output appears in the browser terminal with correct colours — not raw escape sequences like \x1b[32m. Spinners animate.
result: pass
note: "/exit in browser kills PTY cleanly (code=0) and shows session-ended — expected PoC behavior, Phase 2 handles reconnection"

### 4. Browser Keystrokes Reach Claude Code
expected: Type a message in the browser terminal and press Enter — Claude Code receives it and responds. Input is not echoed locally (PTY handles echo).
result: issue
reported: "Ctrl+C on node terminal prints 'Shutting down...' repeatedly but never exits — cannot restart server to retest"
severity: major

### 5. Slash Commands Work
expected: Type `/help` and press Enter — Claude Code's help output appears with formatting intact.
result: [pending]

### 6. Interactive Prompts Work
expected: Trigger a y/n confirmation (e.g. respond to a permission request). Press "y" or "n" — Claude Code registers the choice and continues.
result: [pending]

### 7. Terminal History Scrollable
expected: After enough output accumulates, scroll up with mouse wheel — previous output is visible. Scrollback buffer works.
result: [pending]

## Summary

total: 7
passed: 3
issues: 1
pending: 4
skipped: 0

## Gaps

- truth: "Ctrl+C shuts down the server cleanly and exits the node process"
  status: failed
  reason: "User reported: Ctrl+C prints 'Shutting down...' repeatedly but never exits — server.close() blocks on open WebSocket connections"
  severity: major
  test: 4
  artifacts: []
  missing: []
