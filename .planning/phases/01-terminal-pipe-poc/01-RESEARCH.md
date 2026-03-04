# Phase 1: Terminal Pipe PoC - Research

**Researched:** 2026-03-04
**Domain:** Node.js PTY bridging (node-pty + xterm.js + WebSocket on Windows)
**Confidence:** MEDIUM-HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Phase boundary: `node server.js` starts a Node.js server, opens a browser window, spawns Claude Code via node-pty in a Windows shell, and streams PTY output to xterm.js in the browser.
- No `.ai/` directory -- session registry / PID lock file approach is abandoned for Phase 1.
- No WSL -- Claude Code runs natively in Windows shell (PowerShell/bash). No wsl.exe invocation.
- Phase 1 is PoC only -- node server.js not npx wingman. Distribution is Phase 4.
- PTY is mandatory -- Claude Code detects TTY; plain child_process.spawn breaks slash commands/spinners/colours.
- xterm.js for browser-side terminal rendering.
- WebSocket to bridge PTY output to browser and browser keystrokes to PTY.

### Claudes Discretion
- Exact shell to spawn (cmd vs PowerShell vs bash) -- use whatever works best with node-pty on Windows
- WebSocket library choice (ws is the established default)
- Express vs raw http.createServer
- xterm.js version and addons (FitAddon, WebLinksAddon are standard)
- Port number (7891 suggested)
- Whether to use node-pty prebuilt binaries or build from source

### Deferred Ideas (OUT OF SCOPE)
- .ai/wingman/ session registry -- abandoned entirely
- PID lock file -- deferred/abandoned
- Multi-session / Mission Control -- Phase 3
- Manual mode (--manual flag) -- Phase 3
- npx wingman distribution -- Phase 4
- Claw integration -- post-v1
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POC-01 | node server.js starts a Node.js HTTP/WebSocket server and opens a browser window automatically | open package auto-opens browser; Express serves static files |
| POC-02 | Browser window renders a terminal using xterm.js connected to the server via WebSocket | @xterm/xterm 6.0.0 + native browser WebSocket API |
| POC-03 | Server spawns Claude Code as a PTY child process (via node-pty) on startup | node-pty 1.1.0 with ConPTY; spawn strategy researched (see Shell Spawning section) |
| POC-04 | Claude Code stdout/stderr streams to browser terminal in real time | node-pty onData -> ws.send() -> terminal.write() pipeline |
| POC-05 | User input typed in browser terminal is sent to Claude Code process stdin | terminal.onData -> ws.send() -> pty.write() pipeline |
| POC-06 | Slash commands work correctly in browser terminal | PTY emulation makes Claude Code see a real TTY; slash commands work when PTY is used |
| POC-07 | Interactive prompts work correctly in browser terminal | Same PTY rationale; ConPTY on Windows 10 1809+ supports full interactivity |
| POC-08 | ANSI colours, spinners, and formatting render correctly in browser terminal | xterm.js is a full ANSI terminal emulator; pass raw PTY output directly to terminal.write() |
| POC-09 | Terminal history is scrollable in browser | xterm.js has built-in scrollback buffer (configurable lines) |
</phase_requirements>

---

## Summary

Phase 1 proves the core technical hypothesis: Claude Code running natively on Windows can be wrapped in a pseudo-terminal (PTY) and streamed to a browser xterm.js instance with full interactivity. The stack is mature and proven (VS Code own terminal uses the identical architecture), but Windows-specific spawning of Claude Code has documented pitfalls that require deliberate handling.

The single highest-risk item is how to spawn Claude Code via node-pty on Windows. Claude Code requires Git Bash to run (it uses Git Bash internally even in the native installer), but the **native claude.exe binary has known ConPTY compatibility issues** (hangs in VS Code ConPTY terminal). The **npm-based @anthropic-ai/claude-code** (claude command from npm global install) works correctly with ConPTY. The recommended strategy: spawn Git Bash (bash.exe from Git for Windows) as the PTY shell, then run claude inside it via -c "claude". This keeps Claude Code in its required Git Bash environment while benefiting from ConPTY.

The second risk is **node-pty native compilation on Windows**. node-pty requires C++ build tools. For the PoC (developer-only), building from source is acceptable if the developer already has VS Build Tools. Use @homebridge/node-pty-prebuilt-multiarch as the no-build-tools fallback. Distribution concerns (Phase 4) are out of scope for Phase 1.

**Primary recommendation:** Spawn Git Bash via node-pty on Windows, run claude inside it. Use @xterm/xterm + ws + Express for the browser terminal. Keep the PoC to minimal wiring: one PTY, one WebSocket, one HTML page.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-pty | 1.1.0 | Spawn Claude Code in a pseudo-terminal | Only mature Node.js PTY library. Used by VS Code integrated terminal. ConPTY on Windows 10 1809+. Without it, Claude Code degrades to non-interactive pipe mode. |
| @xterm/xterm | 6.0.0 | Render terminal in browser | Industry standard browser terminal emulator. Same library VS Code uses. Full ANSI parser, canvas renderer, 256-color/truecolor, cursor movement, alternate screen buffer. |
| @xterm/addon-fit | 0.11.0 | Auto-resize terminal to browser container | Calculates correct cols/rows from DOM container size. Required for resize propagation to PTY. |
| ws | 8.19.0 | WebSocket server | De facto Node.js WebSocket library. Zero dependencies. Fast. No framework overhead needed for localhost communication. |
| express | 4.21.0 | HTTP server + static file serving | Already in testbed. express.static() serves HTML/CSS/JS with one line. |
| open | 10.1.0 | Auto-open browser on server start | Cross-platform. Handles Windows default browser correctly. |

### Supporting (PoC-optional)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xterm/addon-web-links | 0.11.0 | Clickable URLs in terminal | Claude Code outputs file paths and URLs. Load alongside FitAddon. Minimal cost to include. |
| @homebridge/node-pty-prebuilt-multiarch | latest | node-pty drop-in with prebuilt binaries | Use if build tools unavailable. Supports Node 18+. Slightly behind node-pty release cadence. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ws | Socket.IO | Socket.IO adds reconnection/rooms. None needed for localhost PoC. ws is simpler. |
| express | raw http.createServer | Express saves boilerplate for static serving. No cost. |
| @xterm/xterm | Custom ANSI renderer | Months of work. No reason. |
| node-pty | child_process.spawn | Fatal: Claude Code detects non-TTY and degrades UI. Never use pipes for interactive CLI. |

**Installation:**
```
npm install express ws node-pty open
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
npm install -D nodemon
```

**Version verification (run before installing):**
```
npm view node-pty version          # currently 1.1.0
npm view @xterm/xterm version      # currently 6.0.0
npm view @xterm/addon-fit version  # currently 0.11.0
npm view ws version                # currently 8.19.0
```

---

## Architecture Patterns

### Recommended Project Structure
```
wingman/
+-- server.js              # Entry point: HTTP + WebSocket server, PTY spawn
+-- package.json
+-- public/
    +-- index.html         # Single page with xterm.js terminal
    +-- terminal.js        # xterm.js init, WebSocket wiring, resize handling
    +-- styles.css         # Terminal container styling (full-height, dark bg)
```

Phase 1 is intentionally minimal. No subdirectories, no modules, no session management. Everything in one server.js.

### Pattern 1: Minimal PTY-to-WebSocket Wiring

**What:** Single PTY spawned on server start. Single WebSocket endpoint. Browser connects, gets live PTY output, sends keystrokes back.

**When to use:** PoC -- prove the pipe works before adding complexity.

**Shell strategy (Windows):** Spawn bash.exe from Git for Windows, pass -c claude as argument. This gives Claude Code the Git Bash environment it requires while the outer PTY is owned by node-pty/ConPTY.

**Data flow:**
```
Browser (xterm.js)                    Node.js Server
  |                                     |
  |-- WebSocket -- {type:input} ------> | pty.write(data)
  |                                     |     |
  |                                     |     v
  |<-- WebSocket -- {type:output} ----- | pty.onData -> ws.send()
  |                                     |
  |-- WebSocket -- {type:resize} -----> | pty.resize(cols, rows)
```

**Environment variables required in PTY spawn options:**
- TERM: xterm-256color -- tells Claude Code what terminal type it is running in
- COLORTERM: truecolor -- enables 24-bit colour output
- ...process.env -- inherits PATH so claude command is findable

**Git Bash path detection strategy:**
- Default: C:\Program Files\Git\bin\bash.exe
- Fallback: C:\Program Files (x86)\Git\bin\bash.exe
- Override: WINGMAN_BASH_PATH environment variable
- Fail fast with clear error if Git Bash not found

### Pattern 2: xterm.js Browser Initialization

**What:** Initialize xterm.js with FitAddon. Connect to WebSocket. Wire terminal output, input, and resize.

**Critical rules:**
1. Do NOT call term.write(data) inside term.onData callback -- PTY handles echo
2. DO wire ResizeObserver from the start -- missing resize makes terminal look broken
3. DO set scrollback: 10000 for adequate history (POC-09)

**CDN approach for PoC (no bundler needed):**
Load xterm.js and addons from jsDelivr CDN. Eliminates all bundler complexity.
```
https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.css
https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/lib/xterm.js
https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.11.0/lib/addon-fit.js
https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.js
```

**Note on CDN globals:** When loaded via script tags (not ES modules), constructors are namespaced:
- new Terminal(options) -- from xterm.js global
- new FitAddon.FitAddon() -- NOT new FitAddon()
- new WebLinksAddon.WebLinksAddon() -- NOT new WebLinksAddon()

### Pattern 3: Message Protocol

All WebSocket messages are JSON envelopes with a type field.

Browser to Server:
  { "type": "input", "data": "<keystroke string>" }
  { "type": "resize", "cols": 120, "rows": 30 }

Server to Browser:
  { "type": "output", "data": "<raw PTY output string>" }
  { "type": "session-ended" }

Simple, debuggable, extensible. The type field makes adding new message kinds in Phase 2+ trivial.

### Pattern 4: Module System -- CommonJS (CJS)

Use require() not import for server code. node-pty is a native addon that is CJS. Express 4 is CJS. The testbed is already CJS. Browser code uses CDN-loaded globals (no module system required for PoC).

### Anti-Patterns to Avoid

- **No local echo in xterm.js:** term.onData must only send to WebSocket, never call term.write(data). The PTY handles all echo. Local echo causes every keystroke to appear twice.
- **No plain child_process.spawn:** Claude Code detects non-TTY and disables interactive UI. PTY is mandatory.
- **No innerHTML for terminal rendering:** Use xterm.js from the start. An interim pre tag approach creates throwaway work.
- **No spawning native claude.exe:** The native binary has ConPTY compatibility issues. Spawn claude from the npm global install via Git Bash.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ANSI escape sequence rendering | Custom parser/renderer | @xterm/xterm | ANSI spec is 200+ pages; cursor movement, alternate screen, 256-color, truecolor, VT sequences. xterm.js has years of work fixing edge cases. |
| Terminal resize calculation | cols/rows math from pixels | @xterm/addon-fit | Font metrics + container size + scroll bars make this non-trivial. FitAddon handles it. |
| PTY spawning | child_process.spawn with pipes | node-pty | Pipes are not a PTY. Claude Code degrades without PTY. |
| Browser auto-open | platform-specific open command | open package | Cross-platform, default browser detection, edge cases with browser path detection. |

**Key insight:** The entire value of this stack is that xterm.js + node-pty are both deeply battle-tested terminal components. The implementation task is wiring them together, not implementing terminal emulation.

---

## Common Pitfalls

### Pitfall 1: Claude Code Native Binary ConPTY Incompatibility (CRITICAL -- Windows-specific)

**What goes wrong:** The native claude.exe (installed via irm https://claude.ai/install.ps1 | iex) freezes in ConPTY environments including VS Code terminal and likely any node-pty ConPTY wrapper. The binary becomes unresponsive -- no prompt appears, keyboard input is not registered.

**Why it happens:** The native binary handles terminal I/O differently from the npm version and is incompatible with ConPTY pseudo-terminal layer. Reported in anthropics/claude-code issue #24584, affecting version 2.1.37+ of the native installer.

**How to avoid:** Use the **npm-based Claude Code** (npm install -g @anthropic-ai/claude-code) instead of the native installer binary. Verify which claude is on PATH before starting development:
```
where.exe claude
# GOOD: C:\Users\<user>\AppData\Roaming\npm\claude
# RISKY: C:\Users\<user>\.local\bin\claude.exe
```
If the native binary is first on PATH, rename it or reorder PATH.

**Warning signs:** PTY spawns successfully, Git Bash starts, but Claude Code shows banner then freezes with no prompt.

---

### Pitfall 2: Spawning Wrong Shell (Git Bash vs PowerShell)

**What goes wrong:** Claude Code on Windows requires Git Bash to run -- it uses Git Bash internally for shell operations. Spawning powershell.exe and running claude inside it causes "No suitable shell found" or "Raw mode not supported" errors from Claude Code itself.

**Why it happens:** Claude Code Windows implementation relies on bash.exe from Git for Windows. When run from PowerShell without Git Bash available in the environment, it cannot find a suitable shell.

**How to avoid:** Spawn Git Bash explicitly as the PTY shell. Pass -c claude as the command argument.

Correct approach:
  Shell: C:\Program Files\Git\bin\bash.exe
  Args:  [-c, claude]

Wrong approach:
  Shell: powershell.exe
  Args:  [-NoExit, -Command, claude]

**Warning signs:** "No suitable shell found", "Raw mode is not supported on the current process.stdin", or Claude Code exits immediately after spawning.

**Fallback if Git Bash + ConPTY has issues:** If spawning Git Bash via ConPTY shows garbled output (a known historical issue in node-pty issue #137), try useConpty: false in the pty.spawn() options. This trades some ConPTY features for compatibility. Note the useConpty option is passed in the spawn options object.

---

### Pitfall 3: node-pty Build Failure on Windows

**What goes wrong:** npm install node-pty fails with gyp ERR\!, cl.exe not found, or MSBuild errors if Visual Studio Build Tools are not installed.

**Why it happens:** node-pty is a native C++ addon. It requires Python 3.x, Visual Studio Build Tools with C++ workload, and Windows SDK.

**How to avoid:**
- For PoC developer use: verify VS Build Tools are present before npm install node-pty
- If build fails, use @homebridge/node-pty-prebuilt-multiarch as a drop-in replacement (same API, different package name in require)
- Pin Node.js version in .nvmrc (project uses Node 20.19.1 per runtime check)

Prebuilt fallback:
  npm install @homebridge/node-pty-prebuilt-multiarch
  In server.js: const pty = require("@homebridge/node-pty-prebuilt-multiarch");

**Warning signs:** npm install fails before server starts. Error mentions gyp, MSBuild, cl.exe, or Python.

---

### Pitfall 4: Input Echo Duplication

**What goes wrong:** Every keystroke appears twice (typing "hello" shows "hheelllloo").

**Why it happens:** PTY naturally echoes input back (standard terminal behavior). If xterm.js onData also calls term.write(data) locally, echo happens twice.

**Rule:** The term.onData callback must ONLY send to WebSocket. Never call term.write() inside term.onData.

**Warning signs:** Immediately visible when typing. Every character doubled.

---

### Pitfall 5: Terminal Resize Not Propagated

**What goes wrong:** Claude Code wraps output at the initial PTY column width regardless of browser window size. Tables misalign.

**Why it happens:** The PTY has a fixed size set at spawn time. The browser xterm.js auto-resizes but pty.resize(cols, rows) must be called explicitly on the server whenever the browser terminal dimensions change.

**How to avoid:** Wire up ResizeObserver + fitAddon.fit() + WebSocket resize message + server pty.resize() from day one. Debounce resize messages (50ms) to avoid flooding during drag-resize.

**Warning signs:** Resize browser window while Claude Code is running. Content wraps at old width.

---

### Pitfall 6: Git Bash Path with Spaces

**What goes wrong:** Paths like C:\Program Files\Git\bin\bash.exe can cause failures in some contexts due to the space in Program Files.

**How to avoid:** Pass the full path as a string to pty.spawn() as the first argument (not as part of a shell command string). node-pty passes it directly to CreateProcess, so spaces in the executable path are handled correctly.

---

### Pitfall 7: Missing TERM and COLORTERM Environment Variables

**What goes wrong:** Claude Code outputs plain text without ANSI color codes; spinners render as raw characters.

**How to avoid:** Include these in the PTY spawn env:
  TERM: xterm-256color
  COLORTERM: truecolor

**Warning signs:** Claude Code output is monochrome or shows raw escape sequences as text.

---

### Pitfall 8: WebSocket Binary vs Text Frame Confusion

**What goes wrong:** Garbled output with multi-byte characters (emoji, Unicode filenames). Replacement characters appear.

**How to avoid:** node-pty 1.1.0 emits strings by default (UTF-8). Send as JSON text frames (JSON.stringify wrapper). xterm.js write() accepts strings directly. Do not use binary WebSocket frames for PoC.

---

## Code Examples

Verified patterns from official sources and working projects.

### server.js: Key PTY Spawn Configuration

The critical configuration for spawning Claude Code via Git Bash on Windows:

```
const pty = require("node-pty");

const BASH_PATH = process.env.WINGMAN_BASH_PATH
  || "C:\\Program Files\\Git\\bin\\bash.exe";

const ptyProcess = pty.spawn(BASH_PATH, ["-c", "claude"], {
  name: "xterm-256color",
  cols: 120,
  rows: 30,
  cwd: process.cwd(),
  env: {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  },
});
```

### WebSocket Server: PTY-to-WebSocket Bridge

Source: ws npm package docs + node-pty README patterns

```
const { WebSocketServer } = require("ws");
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  // PTY output -> browser
  const dataHandler = ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "output", data }));
    }
  });

  // Browser input -> PTY
  ws.on("message", (rawMsg) => {
    const msg = JSON.parse(rawMsg.toString());
    if (msg.type === "input") ptyProcess.write(msg.data);
    else if (msg.type === "resize") ptyProcess.resize(msg.cols, msg.rows);
  });

  ws.on("close", () => dataHandler.dispose());
});
```

### terminal.js: xterm.js Browser Wiring

Source: xterm.js docs (xtermjs.org) + FitAddon README

```
// CDN globals: Terminal, FitAddon.FitAddon, WebLinksAddon.WebLinksAddon
const term = new Terminal({
  cursorBlink: true,
  scrollback: 10000,
  theme: { background: "#0d1117", foreground: "#c9d1d9" },
  fontFamily: "Cascadia Code, Fira Code, monospace",
  fontSize: 14,
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon.WebLinksAddon());
term.open(document.getElementById("terminal"));
fitAddon.fit();

const ws = new WebSocket("ws://" + location.host);

// PTY output -> terminal (write raw data -- xterm.js handles ANSI)
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "output") term.write(msg.data);
  else if (msg.type === "session-ended") term.writeln("\r\n[Session ended]");
};

// Terminal input -> PTY (DO NOT locally echo)
term.onData((data) => {
  if (ws.readyState === WebSocket.OPEN)
    ws.send(JSON.stringify({ type: "input", data }));
});

// Resize: browser resize -> PTY resize (debounced)
let resizeTimeout;
const observer = new ResizeObserver(() => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    fitAddon.fit();
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
  }, 50);
});
observer.observe(document.getElementById("terminal"));

ws.onopen = () => {
  fitAddon.fit();
  ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| wsl.exe bridge for Claude Code on Windows | Native Windows Claude Code (Git Bash shell) | 2025 | No WSL layer needed; simpler spawning but Git Bash dependency |
| xterm (unscoped npm package) | @xterm/xterm (scoped) | xterm.js v5 | Different npm package name; CDN URLs also changed |
| winpty library in node-pty | ConPTY (Windows 10 1809+) | node-pty 1.0.0 | ConPTY is the only Windows PTY backend; winpty removed |
| Native claude.exe installer | npm @anthropic-ai/claude-code for programmatic PTY use | Late 2025 | Native binary has ConPTY incompatibility; npm version required |

**Deprecated/outdated:**
- **WSL spawning strategy:** The prior STACK.md and ARCHITECTURE.md research recommended spawning wsl.exe. Superseded by user constraint (No WSL). Ignore those sections of the prior research.
- **xterm (unscoped package):** Use @xterm/xterm. The unscoped xterm is the v4 legacy package.
- **winpty:** Removed from node-pty. Do not reference winpty in any code.
- **Native claude.exe binary:** Do not spawn via node-pty ConPTY. Use the npm global version.

---

## Open Questions

1. **Git Bash path variation**
   - What we know: Git Bash is typically at C:\Program Files\Git\bin\bash.exe but can vary (32-bit path, user-local install, custom install directory)
   - What is unclear: The developer exact Git for Windows installation path
   - Recommendation: Support WINGMAN_BASH_PATH env var override. During PoC, hardcode the default and validate manually. Add path detection in Phase 4.

2. **Claude Code binary type (native vs npm)**
   - What we know: Native claude.exe has ConPTY issues; npm @anthropic-ai/claude-code works. Both may be installed.
   - What is unclear: Which claude is currently first on the developer PATH
   - Recommendation: Run where.exe claude before starting development. Verify it points to npm version. Document as a known prerequisite check.

3. **ConPTY + Git Bash interaction**
   - What we know: node-pty uses ConPTY on Windows. Git Bash has some TTY quirks (reported "weird output" in node-pty issue #137 from older versions). The Obsidian claude-code-terminal project defaults to powershell.exe.
   - What is unclear: Whether spawning Git Bash via ConPTY in node-pty 1.1.0 causes output issues, or if this was fixed.
   - Recommendation: Test this early in Wave 1 as a spike. If Git Bash via ConPTY shows garbled output, try useConpty: false option in pty.spawn(). Document what works.

4. **@anthropic-ai/claude-code npm status**
   - What we know: One search result mentioned npm install may be "deprecated per official documentation." The native installer is the recommended install method for end users.
   - What is unclear: Whether the npm package is deprecated (no updates) or just no longer the primary install recommendation.
   - Recommendation: Run npm view @anthropic-ai/claude-code and check for deprecation notice. If deprecated, the PoC still works with an older version, but flag for Phase 4 distribution planning.

---

## Validation Architecture

nyquist_validation is enabled (per .planning/config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project root |
| Config file | None -- no jest.config, vitest.config, or test/ directory found |
| Quick run command | N/A -- all validation is smoke testing for Phase 1 |
| Full suite command | N/A |

Phase 1 is a PoC with minimal unit-testable logic. The core deliverable is a running interactive terminal -- inherently a manual/smoke test. Unit testing PTY spawning requires a live process and a real PTY. All validation is manual smoke testing.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POC-01 | Server starts and browser opens | smoke | node server.js -- verify process starts, browser opens | Wave 0: server.js |
| POC-02 | xterm.js renders in browser | smoke | Open browser, verify terminal visible | Wave 0: public/index.html |
| POC-03 | node-pty spawns Claude Code | smoke | Check PTY process spawns (manual) | Wave 0: server.js |
| POC-04 | Output streams to browser | smoke | Type into browser terminal, see response | Manual interactive |
| POC-05 | User input reaches Claude Code | smoke | Same as POC-04 | Manual interactive |
| POC-06 | Slash commands work | smoke | Type /help in browser terminal | Manual interactive |
| POC-07 | Interactive prompts work | smoke | Trigger a y/n confirmation | Manual interactive |
| POC-08 | ANSI renders correctly | smoke | Observe colours/spinners in browser | Manual visual |
| POC-09 | Terminal scrolls | smoke | Generate enough output, scroll up | Manual interactive |

All POC requirements are interactive/visual. Definition of done for Phase 1: developer runs node server.js, browser opens, types /help, sees formatted coloured output with Claude Code full UI.

### Sampling Rate
- **Per task commit:** Manual smoke test (launch server, verify terminal appears)
- **Per wave merge:** Full interactive test (all 9 POC requirements verified manually)
- **Phase gate:** Full interactive test green before moving to Phase 2

### Wave 0 Gaps
- [ ] server.js -- main entry point (does not exist in project root; testbed/server.js is a different application)
- [ ] public/index.html -- terminal page (does not exist; testbed is a different app)
- [ ] public/terminal.js -- xterm.js wiring
- [ ] public/styles.css -- terminal container styles
- [ ] package.json -- project root package.json (currently only testbed has one)

The existing testbed in testbed/ is a prompt/context manager UI and is NOT reused for Phase 1. Phase 1 creates new files at the project root.

---

## Sources

### Primary (HIGH confidence)
- [node-pty README (microsoft/node-pty)](https://github.com/microsoft/node-pty/blob/main/README.md) -- Windows requirements, ConPTY, PowerShell as default Windows shell
- [xterm.js official site (xtermjs.org)](https://xtermjs.org/) -- xterm.js v6, addon-fit, addon-web-links
- npm package versions verified live from this machine: node-pty 1.1.0, @xterm/xterm 6.0.0, ws 8.19.0, @xterm/addon-fit 0.11.0
- [anthropics/claude-code issue #24584](https://github.com/anthropics/claude-code/issues/24584) -- Native claude.exe ConPTY freeze bug, npm version as workaround

### Secondary (MEDIUM confidence)
- [SmartScope: Claude Code Windows Native Installation](https://smartscope.blog/en/generative-ai/claude/claude-code-windows-native-installation/) -- Git Bash dependency confirmed; npm vs native binary distinction
- [anthropics/claude-code issue #3461](https://github.com/anthropics/claude-code/issues/3461) -- "No suitable shell found" in Git Bash context
- [anthropics/claude-code issue #8674](https://github.com/anthropics/claude-code/issues/8674) -- VS Code extension fails to detect Git Bash on Windows
- [Obsidian claude-code-terminal plugin](https://github.com/dternyak/claude-code-terminal) -- node-pty + xterm.js integration reference; defaults to powershell.exe
- [homebridge/node-pty-prebuilt-multiarch](https://github.com/homebridge/node-pty-prebuilt-multiarch) -- Prebuilt binary fallback for no-build-tools scenarios
- [eclipse-theia issue #15029](https://github.com/eclipse-theia/theia/issues/15029) -- node-pty build failure on Windows with Node.js 22.x (illustrates ongoing build tool issues)
- [GitSquared browser terminal gist](https://gist.github.com/GitSquared/2049d7e85eaddeeeaa44e8404fe0b0e1) -- Complete PTY-to-browser wiring example (older API but pattern still valid)

### Tertiary (LOW confidence)
- WebSearch: Claude Code Git Bash TTY issues, node-pty ConPTY workarounds (multiple sources, consistent pattern, no single authoritative doc)
- [Ashish Poudel substack](https://ashishpoudel.substack.com/p/web-terminal-with-xtermjs-node-pty) -- Uses old xterm API and socket.io; wiring pattern valid but syntax outdated

---

## Metadata

**Confidence breakdown:**
- Standard stack (node-pty, xterm.js, ws, express): HIGH -- same stack used by VS Code, code-server, Theia, Gitpod; versions verified live from npm
- Architecture (PTY wiring pattern): HIGH -- proven pattern with multiple independent implementations
- Windows Claude Code spawning strategy (Git Bash + npm version): MEDIUM -- confirmed from multiple sources but ConPTY + Git Bash interaction needs hands-on validation; active GitHub issues suggest edge cases remain
- node-pty build on Windows: MEDIUM -- known issue with well-documented solutions; prebuilt fallback is proven

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days -- node-pty and xterm.js are stable; Claude Code Windows support is more active)

**Key open risk requiring hands-on validation:** The interaction between node-pty ConPTY + Git Bash + npm Claude Code cannot be fully verified by research alone. Wave 1 of Phase 1 should include a targeted spike: spawn Git Bash via node-pty ConPTY with a simple interactive program, verify output is clean. If clean, proceed to spawning Claude Code. If output is garbled, apply useConpty: false or PowerShell workaround before proceeding.

