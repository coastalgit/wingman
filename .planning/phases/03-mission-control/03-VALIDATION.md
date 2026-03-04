---
phase: 3
slug: mission-control
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual UAT (no automated test framework in project) |
| **Config file** | none |
| **Quick run command** | `node server.js` then manual browser testing |
| **Full suite command** | Manual verification checklist (all 15 requirements) |
| **Estimated runtime** | ~5 minutes per full walkthrough |

---

## Sampling Rate

- **After every task commit:** `node server.js` + manual browser check of changed behavior
- **After every plan wave:** Full requirement checklist walkthrough
- **Before `/gsd:verify-work`:** All 15 requirements verified manually
- **Max feedback latency:** ~60 seconds (server restart + browser refresh)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Verification | Status |
|---------|------|------|-------------|-----------|--------------|--------|
| 03-01-01 | 01 | 1 | MC-01 | manual | Start server, verify browser opens to dashboard | ⬜ pending |
| 03-01-02 | 01 | 1 | MC-02 | manual | Launch session, verify it appears in list | ⬜ pending |
| 03-01-03 | 01 | 1 | MC-03 | manual | Click New Session, verify new window opens | ⬜ pending |
| 03-01-04 | 01 | 1 | MC-04 | manual | Create/close sessions, verify status changes | ⬜ pending |
| 03-01-05 | 01 | 1 | MC-05 | manual | Click Exit, verify all sessions close + server stops | ⬜ pending |
| 03-02-01 | 02 | 2 | PROC-01 | manual | Run server twice, verify second prints URL | ⬜ pending |
| 03-02-02 | 02 | 2 | PROC-02 | manual | Same as PROC-01 | ⬜ pending |
| 03-02-03 | 02 | 2 | PROC-03 | manual | Kill server, restart, verify clean start | ⬜ pending |
| 03-02-04 | 02 | 2 | PROC-04 | manual | Ctrl+C, verify PID file removed + PTYs dead | ⬜ pending |
| 03-02-05 | 02 | 2 | PROC-05 | manual | Ctrl+C, verify browser shows shutdown message | ⬜ pending |
| 03-02-06 | 02 | 2 | PROC-06 | manual | After shutdown, check for orphan claude.exe | ⬜ pending |
| 03-03-01 | 03 | 3 | MAN-01 | manual | `node server.js --manual`, verify no Claude spawns | ⬜ pending |
| 03-03-02 | 03 | 3 | MAN-02 | manual | Start --manual, verify files exist | ⬜ pending |
| 03-03-03 | 03 | 3 | MAN-03 | manual-only | Requires active Claude Code session | ⬜ pending |
| 03-03-04 | 03 | 3 | MAN-04 | manual-only | Same as MAN-03 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework setup needed — this project uses manual UAT exclusively.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All MC/PROC/MAN behaviors | MC-01 through MAN-04 | Browser interaction + process lifecycle cannot be automated without E2E framework | User launches server, interacts in browser, checks task manager |
| Slash command integration | MAN-03, MAN-04 | Requires live Claude Code session | User runs Claude Code with /ccc and /ccp commands |

---

## Validation Sign-Off

- [x] All tasks have manual verification instructions
- [x] Sampling continuity: every task has a verification step
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
