# Research Summary: Wingman v2

**Domain:** Browser-based terminal UI / process wrapper for Claude Code CLI
**Researched:** 2026-03-04
**Overall confidence:** HIGH (established patterns, well-known libraries, canonical stack)

## Executive Summary

Building a browser-based terminal UI that wraps an interactive CLI process is a well-solved problem in 2025/2026. The canonical stack is node-pty (server-side pseudo-terminal) + xterm.js (browser-side terminal renderer) + ws (WebSocket transport). This exact combination powers VS Code's integrated terminal, code-server (VS Code in the browser), Theia IDE, and dozens of cloud IDE products. There is no serious alternative stack to consider -- these libraries are effectively the only game in town for this use case, and they are all Microsoft-maintained or closely affiliated.

The primary complexity for Wingman is not the terminal pipe itself (that is ~100 lines of code) but the session management layer on top: spawning multiple Claude Code processes, maintaining session state across browser tab close/reopen, graceful cleanup on server exit, and the Windows+WSL boundary. The PoC should validate the PTY-to-browser pipe first, especially the WSL spawning path, before investing in session management.

Windows is the primary development platform, which introduces a specific concern: Claude Code runs in WSL, but Wingman runs on Windows. This means spawning `wsl.exe` from node-pty and dealing with a double PTY layer (ConPTY wrapping WSL's PTY). This works in practice (VS Code does exactly this) but may have edge cases with specific ANSI sequences or terminal resize events.

## Key Findings

**Stack:** node-pty + @xterm/xterm + ws + Express 4. Canonical, proven, no alternatives worth considering.
**Architecture:** Server owns PTY processes, streams to browser via WebSocket, xterm.js renders. Stateless browser, stateful server.
**Critical pitfall:** The WSL double-PTY layer (ConPTY wrapping WSL PTY) and node-pty native compilation on Windows are the highest-risk items for the PoC.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **PoC: Terminal Pipe** - Validate the core data path works
   - Addresses: Single Claude Code session, streaming output, user input
   - Avoids: Premature session management complexity
   - Key risk: WSL spawning via node-pty on Windows

2. **Session Management** - Multiple sessions, lifecycle management
   - Addresses: Mission Control, session launch/close, process cleanup
   - Avoids: Building on unvalidated foundation
   - Depends on: PoC proving the pipe works

3. **Session Persistence** - Reconnection, history, recovery
   - Addresses: Tab close/reopen, server-buffered history, stale PID cleanup
   - Avoids: Over-engineering before multi-session works
   - Depends on: Session management being solid

4. **Polish and Distribution** - npx packaging, manual mode, UX refinement
   - Addresses: `npx wingman`, `--manual` flag, production readiness
   - Depends on: Core features being stable

**Phase ordering rationale:**
- Phase 1 must come first because the entire product depends on the PTY-to-browser pipe working correctly on Windows+WSL. If this fails, the architecture needs to change.
- Phase 2 before 3 because reconnection logic depends on session lifecycle being well-defined.
- Phase 4 last because distribution concerns (npx, native addon packaging) are packaging problems, not functionality problems.

**Research flags for phases:**
- Phase 1: Needs hands-on validation (WSL spawn, ConPTY behavior). Cannot be fully researched -- must be built and tested.
- Phase 2: Standard patterns, unlikely to need research.
- Phase 3: May need research into terminal scrollback buffer management and memory limits.
- Phase 4: Will need research into packaging node-pty native addon for npx distribution (prebuild, postinstall scripts).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Canonical stack, no alternatives. Used by VS Code. |
| Features | HIGH | Well-understood domain (web terminals). Clear requirements from PROJECT.md. |
| Architecture | HIGH | Standard client-server with WebSocket. Proven pattern. |
| Pitfalls | MEDIUM | Windows+WSL specifics need hands-on validation. Training data may miss recent ConPTY improvements. |

## Gaps to Address

- Exact current versions of all packages (WebSearch was unavailable; verify with npm)
- node-pty prebuilt binary availability for current Node.js LTS on Windows
- Whether Claude Code CLI has any TTY detection that might interfere with PTY wrapping
- Memory implications of buffering full terminal scrollback on the server for session reconnection
- npx distribution strategy for packages with native addons (node-pty requires compilation)
