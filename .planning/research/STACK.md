# Technology Stack

**Project:** Wingman v2 -- Browser-based terminal UI for Claude Code
**Researched:** 2026-03-04
**Confidence note:** WebSearch and WebFetch were unavailable. Versions are based on training data (cutoff May 2025) and should be verified with `npm view <package> version` before installing. Core library choices are HIGH confidence (established, stable ecosystem with no viable alternatives).

## Recommended Stack

### PTY / Process Spawning (Server-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **node-pty** | ^1.0.0 | Spawn Claude Code in a pseudo-terminal | The only serious Node.js PTY library. Used by VS Code's integrated terminal. Provides full PTY emulation so interactive programs (Claude Code's slash commands, confirmations, spinners) work correctly. Native addon compiled per-platform. |

**Why PTY instead of child_process pipes:**
- Claude Code is an interactive terminal program that uses ANSI escape codes, cursor movement, spinners, and expects a TTY.
- `child_process.spawn()` with pipes gives you stdout/stderr streams but the child process detects it is not a TTY and changes behavior (no colors, no interactive prompts, buffered output).
- node-pty allocates a real pseudo-terminal, so Claude Code behaves identically to running in a real terminal.
- On Windows, node-pty uses ConPTY (Windows 10+), which is the modern Windows pseudo-console API.

**Windows + WSL consideration:**
- Claude Code CLI runs inside WSL. node-pty can spawn WSL processes from Windows: `pty.spawn('wsl.exe', ['claude', ...args], {...})`.
- Alternatively, run the entire Wingman server inside WSL. This is simpler (node-pty spawns Claude directly) but requires the user to start Wingman from WSL. Recommend: support both, default to WSL spawn from Windows.

### Terminal Rendering (Browser-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@xterm/xterm** | ^5.5.0 | Render terminal output in the browser | The dominant browser terminal emulator. Used by VS Code, Theia, Hyper, and every web-based terminal. Renders ANSI escape sequences, handles cursor positioning, supports themes. Canvas-based rendering for performance. |
| **@xterm/addon-fit** | ^0.10.0 | Auto-resize terminal to container | Keeps xterm dimensions synced with the browser viewport. Essential for responsive layout. |
| **@xterm/addon-web-links** | ^0.11.0 | Clickable URLs in terminal output | Claude Code outputs URLs (docs links, file paths). Makes them clickable. |
| **@xterm/addon-search** | ^0.15.0 | Search within terminal buffer | Useful for finding content in long Claude Code sessions. Add later, not PoC. |

**Package name note:** xterm.js moved from `xterm` to `@xterm/xterm` (scoped packages) starting in v5. Use the scoped names.

**Why not a custom renderer:**
- Claude Code emits raw ANSI escape sequences (colors, cursor movement, screen clearing, Unicode box-drawing characters). Writing a parser is months of work. xterm.js handles all of this out of the box.
- xterm.js uses a canvas renderer (or WebGL addon for extreme performance). This handles thousands of lines of terminal output without DOM thrashing.

### WebSocket (Server-Side)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **ws** | ^8.18.0 | WebSocket server for bidirectional streaming | The standard Node.js WebSocket library. Zero dependencies. Fastest pure-JS implementation. Express can share the same HTTP server. No framework lock-in. |

**Why not Socket.IO:**
- Socket.IO adds reconnection, rooms, namespaces, and HTTP long-polling fallback. None of these are needed here.
- The client and server are both on localhost -- WebSocket support is guaranteed.
- Socket.IO's abstraction layer adds complexity and hides the wire protocol, making debugging harder.
- ws is ~50KB vs Socket.IO's ~300KB. For a local tool, payload size doesn't matter, but unnecessary abstraction does.

### HTTP Server

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **express** | ^4.21.0 | Serve static files, REST API endpoints | Already used in the testbed. Battle-tested. Simple. The PoC needs: static file serving, a few REST endpoints for session management. Express 4 is stable and well-understood. |

**Why not Express 5:**
- Express 5 has been in beta/alpha for years. As of early 2025 it was finally reaching RC status, but the ecosystem (middleware, tutorials, Stack Overflow answers) is still Express 4. For a tool like Wingman where the HTTP layer is trivial, Express 4 is the safe choice.

**Why not Fastify:**
- Fastify is faster and has a better plugin architecture, but the HTTP server is not the bottleneck here. Express is already in the testbed, the team knows it, and switching adds zero value for this use case.

**Why not raw http module:**
- Could work for the PoC, but Express's `express.static()` and router save boilerplate that would just be re-implemented.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **open** | ^10.1.0 | Open browser on server start | `npx wingman` should auto-open the browser. Cross-platform. |
| **commander** | ^12.1.0 | CLI argument parsing | `--port`, `--manual`, `--no-open` flags. |
| **nanoid** | ^5.0.0 | Generate session IDs | Short, URL-safe, collision-resistant IDs. Better than UUID for display. ESM-only in v5; use v4 if sticking with CJS. |
| **strip-ansi** | ^7.1.0 | Strip ANSI codes from terminal output | For session history storage/search where raw text is needed. ESM-only; use v6 for CJS. |

### Dev Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| **nodemon** | ^3.1.0 | Auto-restart server on changes (dev only) |
| **vitest** | ^2.1.0 | Testing framework (if tests are added) |

## Module System Decision: CommonJS

Use **CommonJS** (`require`) for the server, not ESM (`import`).

**Rationale:**
- node-pty is a native addon that uses `require`. While ESM can import CJS via `createRequire`, it adds friction.
- Express 4 is CJS.
- The testbed already uses CJS.
- Several useful utilities (strip-ansi v7, nanoid v5) are ESM-only. For these, either use older CJS versions (strip-ansi v6, nanoid v4) or use dynamic `import()` in CJS.
- The server code is not published as a library -- module system choice has no downstream impact.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| PTY | node-pty | child_process.spawn (pipes) | No TTY emulation; Claude Code won't render correctly, no interactive prompts |
| PTY | node-pty | node-pty-prebuilt-multiarch | Fork with prebuilt binaries -- less maintained, unnecessary if build tools available |
| Terminal UI | @xterm/xterm | Custom ANSI parser + DOM | Months of work to replicate what xterm.js does. No reason to build this. |
| Terminal UI | @xterm/xterm | terminal.js, jquery.terminal | Far less capable, smaller communities, don't handle modern ANSI properly |
| WebSocket | ws | Socket.IO | Unnecessary abstraction for localhost communication |
| WebSocket | ws | uWebSockets.js | Faster but C++ addon, harder to debug, overkill for local tool |
| HTTP | Express 4 | Fastify | No benefit for this use case, Express already in testbed |
| HTTP | Express 4 | Koa | Smaller ecosystem, no benefit, adds learning curve |

## Windows-Specific Considerations

### ConPTY Requirements
- node-pty uses Windows ConPTY API (available since Windows 10 1809)
- Windows 11 (project target) fully supports ConPTY
- Requires C++ build tools for native addon compilation: `npm install --global windows-build-tools` or install Visual Studio Build Tools

### WSL Spawning Strategy
Two approaches for spawning Claude Code (which runs in WSL):

**Option A: Spawn wsl.exe from Windows node-pty (RECOMMENDED for PoC)**
```javascript
const pty = require('node-pty');
const shell = pty.spawn('wsl.exe', ['-e', 'claude'], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: process.cwd(),
});
```
- Pro: Wingman server runs natively on Windows, browser opens naturally
- Pro: No WSL networking configuration needed
- Con: Path translation needed (Windows paths to WSL paths)
- Con: ConPTY wrapping WSL's PTY -- double PTY layer, potential edge cases

**Option B: Run Wingman server inside WSL**
```bash
# From WSL terminal:
npx wingman
```
- Pro: Direct PTY to Claude Code, no double-layer
- Pro: No path translation needed
- Con: WSL networking (localhost forwarding usually works, but can have issues)
- Con: User must remember to start from WSL

**Recommendation:** Start with Option A for the PoC. It matches the developer's existing workflow (Windows terminal, WSL for Claude Code). If PTY edge cases arise, Option B is the fallback.

## Installation

```bash
# Core dependencies
npm install express ws node-pty open commander

# xterm.js (browser - serve from node_modules or use CDN)
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links

# Dev dependencies
npm install -D nodemon
```

**node-pty native compilation note:**
On Windows, node-pty requires:
- Node.js with node-gyp support
- Python 3.x
- Visual Studio Build Tools (C++ workload)

If compilation is problematic, consider using `node-pty-prebuilt-multiarch` which ships prebuilt binaries, though it may lag behind node-pty releases.

## Architecture: How the Pieces Connect

```
Browser (xterm.js)                    Node.js Server
  |                                     |
  |-- WebSocket (ws) ---- data -------> | pty.write(data)
  |                                     |     |
  |                                     |     v
  |                                     |  node-pty
  |                                     |  (ConPTY on Win)
  |                                     |     |
  |<--- WebSocket (ws) -- data -------- | pty.onData(data)
  |                                     |     |
  v                                     v     v
 xterm.write(data)                   Claude Code CLI
 (renders ANSI)                      (running in WSL)
```

Express serves the static HTML/JS/CSS. ws handles the real-time bidirectional stream. node-pty owns the Claude Code child process. xterm.js renders whatever Claude Code outputs.

## Sources

- node-pty: https://github.com/microsoft/node-pty (Microsoft-maintained, used by VS Code)
- xterm.js: https://xtermjs.org/ and https://github.com/xtermjs/xterm.js (also Microsoft-maintained)
- ws: https://github.com/websockets/ws
- Express: https://expressjs.com/
- ConPTY: https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/

**Confidence note:** All version numbers should be verified with `npm view <package> version` before use. The library choices themselves are HIGH confidence -- this is the canonical stack used by VS Code, Theia, code-server, and every serious browser-based terminal project.
