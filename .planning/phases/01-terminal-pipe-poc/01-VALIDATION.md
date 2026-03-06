---
phase: 1
slug: terminal-pipe-poc
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Phase 1 is a PoC; all validation is manual smoke testing |
| **Config file** | none — Wave 0 creates project files |
| **Quick run command** | `node server.js` — verify server starts and browser opens |
| **Full suite command** | Manual interactive test — all 9 POC requirements verified manually |
| **Estimated runtime** | ~2 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Run `node server.js` — verify process starts, browser terminal appears
- **After every plan wave:** Full interactive test (all 9 POC requirements verified manually)
- **Before `/gsd:verify-work`:** Full interactive test green
- **Max feedback latency:** ~2 minutes (manual smoke)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-xx | 01 | 0 | POC-01 | smoke | `node server.js` | ❌ W0 | ⬜ pending |
| 1-01-xx | 01 | 0 | POC-02 | smoke | Open browser, verify terminal visible | ❌ W0 | ⬜ pending |
| 1-01-xx | 01 | 1 | POC-03 | smoke | Check PTY process spawns (manual) | ❌ W0 | ⬜ pending |
| 1-01-xx | 01 | 1 | POC-04 | manual | Type into browser terminal, see response | manual | ⬜ pending |
| 1-01-xx | 01 | 1 | POC-05 | manual | Same as POC-04 | manual | ⬜ pending |
| 1-01-xx | 01 | 1 | POC-06 | manual | Type /help in browser terminal | manual | ⬜ pending |
| 1-01-xx | 01 | 1 | POC-07 | manual | Trigger a y/n confirmation | manual | ⬜ pending |
| 1-01-xx | 01 | 1 | POC-08 | manual | Observe colours/spinners in browser | manual | ⬜ pending |
| 1-01-xx | 01 | 1 | POC-09 | manual | Generate output, scroll up | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server.js` — main entry point (does not exist; testbed/server.js is a different app)
- [ ] `public/index.html` — terminal browser page
- [ ] `public/terminal.js` — xterm.js wiring (WebSocket + PTY bridge)
- [ ] `public/styles.css` — terminal container styles
- [ ] `package.json` — project root package.json (currently only testbed has one)

*All 5 files must be created in Wave 0 before any interactive testing is possible.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Server starts, browser opens | POC-01 | Requires live process | Run `node server.js`, verify browser window opens |
| xterm.js renders in browser | POC-02 | Visual check | Verify terminal element visible, cursor blinking |
| PTY spawns Claude Code | POC-03 | Requires live Claude Code process | Check Claude Code banner appears in browser terminal |
| Output streams to browser | POC-04 | Interactive PTY | Type a message, verify response streams in real time |
| User input reaches Claude Code | POC-05 | Interactive PTY | Same as POC-04, verify Claude Code responds |
| Slash commands work | POC-06 | Interactive | Type `/help`, verify slash command menu appears |
| Interactive prompts work | POC-07 | Interactive | Trigger a y/n confirmation, verify keyboard input works |
| ANSI colours/spinners render | POC-08 | Visual | Observe Claude Code spinner and coloured output |
| Terminal history scrollable | POC-09 | Interactive | Generate output, scroll up with mouse/keyboard |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
