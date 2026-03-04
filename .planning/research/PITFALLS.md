# Domain Pitfalls

**Domain:** Browser-based terminal wrapper (Node.js server spawning Claude Code, streaming to browser via WebSocket)
**Researched:** 2026-03-04
**Overall confidence:** MEDIUM (based on training data for well-established patterns; no live source verification available)

---

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Using child_process Pipes Instead of a PTY

**What goes wrong:** Using `child_process.spawn()` with default stdio pipes instead of a pseudo-terminal (PTY). Interactive programs like Claude Code detect they are not running in a terminal and disable rich output -- spinners, colors, ANSI escape sequences, interactive prompts, and cursor-based menus all disappear or break. Some programs refuse to run interactively at all when stdout is a pipe.

**Why it happens:** `child_process.spawn` is the obvious Node.js API. Developers reach for it first, get basic output streaming working, and only discover the interactivity loss later when Claude Code's rich UI features (tool confirmations, slash command menus, progress indicators) render as garbage or don't appear.

**Consequences:**
- Claude Code outputs flat text instead of rich terminal UI
- Interactive prompts (y/n confirmations, menus) may not render at all
- Spinner/progress indicators break (they rely on cursor repositioning)
- The entire value proposition of "same interactivity as terminal" collapses

**Prevention:** Use `node-pty` (or the newer `@lydell/node-pty` fork) from day one. It allocates a real pseudo-terminal so the child process believes it is running in a terminal. This is non-negotiable for Claude Code.

```javascript
// WRONG
const child = spawn('claude', [], { stdio: ['pipe', 'pipe', 'pipe'] });

// RIGHT
const pty = require('node-pty');
const shell = pty.spawn('claude', [], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: projectDir,
  env: process.env
});
```

**Detection:** If Claude Code output in the browser looks like plain text without colors, spinners freeze as repeated characters, or interactive menus don't appear -- you're running through pipes, not a PTY.

**Phase:** Must be correct in Phase 1 (PoC). This is architectural -- retrofitting from pipes to PTY requires rewriting the entire process management layer.

---

### Pitfall 2: Zombie Processes on Server Crash or Ungraceful Shutdown

**What goes wrong:** When the Node.js server crashes, is killed (Ctrl+C, SIGKILL, task manager), or the terminal hosting it closes, spawned Claude Code child processes are orphaned. They continue running in the background, holding locks, consuming resources, and blocking the next launch.

**Why it happens:** Node.js does not automatically kill child processes on exit. PTY-spawned processes are even more prone to this because they run in their own process group. On Windows, process tree management is particularly unreliable -- `process.kill()` may not propagate to grandchildren.

**Consequences:**
- Orphaned Claude Code processes consume API credits and system resources
- PID lock file becomes stale, blocking next Wingman launch
- Multiple Claude instances may conflict on the same project
- On Windows, orphaned conpty host processes accumulate

**Prevention:**
1. Register handlers for `process.on('exit')`, `SIGINT`, `SIGTERM`, and `uncaughtException`
2. Maintain a process registry (Map of session ID to PTY handle)
3. On any shutdown signal, iterate the registry and call `pty.kill()` on each
4. Write PID file on startup; on next launch, check if PID is alive and clean up if stale
5. On Windows, use `taskkill /T /F /PID` for tree-kill as a fallback

```javascript
const sessions = new Map();

function cleanupAll() {
  for (const [id, pty] of sessions) {
    try { pty.kill(); } catch (e) { /* already dead */ }
  }
  // Remove PID lock file
  try { fs.unlinkSync(lockFilePath); } catch (e) {}
}

process.on('exit', cleanupAll);
process.on('SIGINT', () => { cleanupAll(); process.exit(0); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(0); });
process.on('uncaughtException', (err) => {
  console.error(err);
  cleanupAll();
  process.exit(1);
});
```

**Detection:** After a crash, check for orphaned processes: `tasklist | findstr claude` on Windows, `ps aux | grep claude` on WSL/Linux. If Claude processes exist without a Wingman server, you have zombies.

**Phase:** Phase 1 (PoC) should have basic cleanup. Phase 2 (Core) needs robust PID lock file and stale process recovery.

---

### Pitfall 3: node-pty Native Module Build Failures on Windows

**What goes wrong:** `node-pty` is a native C++ addon that requires compilation. On Windows, installation fails if the build toolchain is missing or misconfigured. This is the single most common blocker for Windows developers trying to use node-pty.

**Why it happens:** node-pty depends on `node-gyp` which requires Python, Visual Studio Build Tools (or full VS), and a compatible Node.js version. Windows users frequently have incomplete toolchains. The error messages are cryptic C++ compilation failures that don't point to the root cause.

**Consequences:**
- `npm install` fails completely -- project is dead on arrival
- Users without VS Build Tools cannot install the project
- Different Node.js versions may require different prebuilt binaries
- CI/CD pipelines need special Windows configuration

**Prevention:**
1. Document prerequisites clearly: `npm install --global windows-build-tools` or manual VS Build Tools install
2. Consider `@lydell/node-pty` fork which may have better prebuilt binary support
3. Pin Node.js version in `.nvmrc` or `engines` field
4. Test installation on a clean Windows machine early
5. Provide clear error messages in your `postinstall` script if node-pty fails
6. For `npx` distribution, consider bundling prebuilt binaries or using `prebuild-install`

**Detection:** `npm install` fails with errors mentioning `gyp ERR!`, `MSBuild`, `cl.exe`, or `python`. Users report "can't install" before they ever run the app.

**Phase:** Phase 1 (PoC) -- must be solved before any user can run the tool. Consider this a gating dependency for the `npx wingman` distribution story.

---

### Pitfall 4: ANSI Escape Code Mishandling Between PTY and Browser

**What goes wrong:** Raw PTY output contains ANSI escape sequences for colors, cursor movement, screen clearing, alternate screen buffer, and mouse tracking. Naive approaches either strip these (losing Claude Code's rich UI), pass them raw to HTML (rendering as garbage text), or partially parse them (causing visual corruption).

**Why it happens:** ANSI is a complex specification. Claude Code uses sophisticated terminal features: 256-color and truecolor output, cursor repositioning for spinners, line clearing for progress bars, and possibly alternate screen buffer for full-screen menus. A simple regex strip will break things; a naive pass-through will display `\e[32m` as literal text.

**Consequences:**
- Spinners and progress bars render as scrolling garbage
- Colors don't render or render incorrectly
- Cursor-repositioned content overwrites wrong areas
- Screen clears wipe the entire scrollback instead of the viewport
- Claude Code's tool use confirmation dialogs render incorrectly

**Prevention:** Use `xterm.js` in the browser. It is a full terminal emulator that natively understands ANSI escape codes, cursor movement, alternate screen buffer, and 256-color/truecolor. Do not try to build your own ANSI parser or convert ANSI to HTML.

```javascript
// Browser side
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

const term = new Terminal({
  cursorBlink: true,
  theme: { background: '#1a1a2e' },
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 14
});
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(document.getElementById('terminal'));
fitAddon.fit();

// Write raw PTY output directly to xterm.js -- it handles ANSI natively
websocket.onmessage = (event) => {
  term.write(event.data);
};
```

**Detection:** If you see literal escape characters (`^[[32m`, `ESC[2J`) in the browser, or if Claude Code's spinner appears as a column of characters instead of animating in place, ANSI handling is broken.

**Phase:** Phase 1 (PoC). xterm.js must be the rendering layer from the start. Do not prototype with a `<pre>` tag and innerHTML -- it creates throwaway work.

---

### Pitfall 5: Terminal Resize Not Propagated

**What goes wrong:** When the browser window resizes, the xterm.js terminal resizes, but the PTY on the server is not informed. Claude Code continues outputting for the old column width, causing line wrapping at wrong positions, broken table layouts, and misaligned UI elements.

**Why it happens:** Terminal size is a property of the PTY, not the output stream. The PTY must be explicitly told its new dimensions via `pty.resize(cols, rows)`. This requires a resize event chain: browser window resize -> xterm.js FitAddon recalculates -> WebSocket message to server -> server calls `pty.resize()`.

**Consequences:**
- Claude Code output wraps at wrong column
- Tables and formatted output are misaligned
- Long lines overflow or get truncated
- After resize, existing content looks corrupted until new content pushes it off screen

**Prevention:**
```javascript
// Browser: detect resize and send to server
const resizeObserver = new ResizeObserver(() => {
  fitAddon.fit();
  const { cols, rows } = term;
  ws.send(JSON.stringify({ type: 'resize', cols, rows }));
});
resizeObserver.observe(terminalContainer);

// Server: apply resize to PTY
ws.on('message', (msg) => {
  const data = JSON.parse(msg);
  if (data.type === 'resize') {
    pty.resize(data.cols, data.rows);
  }
});
```

Debounce the resize messages (50-100ms) to avoid flooding the server during drag-resize.

**Detection:** Resize the browser window while Claude Code is outputting. If the text wraps at the old width instead of reflowing, resize propagation is broken.

**Phase:** Phase 1 (PoC) -- simple to implement alongside the initial WebSocket setup. Missing it makes the PoC look broken on any non-default window size.

---

## Moderate Pitfalls

### Pitfall 6: WebSocket Reconnection Without Session Recovery

**What goes wrong:** User closes browser tab or loses network briefly, then reconnects. The WebSocket connection is new, but the PTY session is still running. Without session recovery, the user sees a blank terminal with no history, even though the Claude Code process is still alive and may be waiting for input.

**Why it happens:** WebSocket is stateless per connection. A new connection knows nothing about what was previously sent. Most WebSocket tutorials show fire-and-forget messaging with no replay buffer.

**Prevention:**
1. Server maintains a scrollback buffer per session (ring buffer, e.g. last 100KB of output)
2. On new WebSocket connection for an existing session, replay the buffer before attaching live output
3. Associate sessions with IDs, not WebSocket connections
4. Client sends session ID on reconnect; server looks up the running PTY and attaches

```javascript
// Server session registry
const sessions = new Map(); // sessionId -> { pty, buffer: [], wsConnections: Set }

function onConnect(ws, sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    // Replay buffered output
    for (const chunk of session.buffer) {
      ws.send(chunk);
    }
    session.wsConnections.add(ws);
  }
}
```

**Detection:** Close the browser tab, reopen it, and navigate to the same session. If you see a blank screen instead of the conversation history, session recovery is missing.

**Phase:** Phase 2 (Core) -- not needed for PoC but required before the product is usable day-to-day. PROJECT.md explicitly lists this as a Core requirement.

---

### Pitfall 7: Input Echo Duplication

**What goes wrong:** When the user types in xterm.js and sends keystrokes to the PTY, the PTY echoes them back (this is standard terminal behavior). If xterm.js also locally echoes the input, every character appears twice: once from local echo and once from PTY echo.

**Why it happens:** In a real terminal, the PTY handles all echo. But developers sometimes add local echo in xterm.js for "responsiveness" or because they're treating it like a chat input. The PTY's echo then doubles everything.

**Prevention:** Do NOT enable local echo in xterm.js when connected to a PTY. Let the PTY handle all echo. The `term.onData` callback should send keystrokes to the server without writing them to the terminal.

```javascript
// WRONG: local echo + PTY echo = double characters
term.onData((data) => {
  term.write(data);         // local echo -- DON'T DO THIS
  ws.send(data);
});

// RIGHT: let PTY echo handle it
term.onData((data) => {
  ws.send(JSON.stringify({ type: 'input', data }));
});
```

**Detection:** Type a character. If it appears twice (e.g., typing "hello" shows "hheelllloo"), you have double echo.

**Phase:** Phase 1 (PoC). Easy to get right if you know about it; maddening to debug if you don't.

---

### Pitfall 8: Windows Process Spawning Path and Shell Issues

**What goes wrong:** On Windows, `node-pty` spawns processes through `conpty` (Windows pseudo-console). Spawning `claude` may fail because: (a) the Claude Code CLI is installed in WSL, not Windows-native, (b) the PATH in the PTY environment doesn't include the directory where `claude` is installed, (c) shell selection matters -- spawning `cmd.exe` vs `powershell.exe` vs `wsl.exe` gives different environments.

**Why it happens:** The developer's setup has Claude Code CLI in WSL. But `node-pty` on Windows spawns a Windows process. To reach Claude Code, you must spawn `wsl.exe` as the shell and then run `claude` inside it. This adds a layer of indirection that affects environment variables, working directory mapping, and signal propagation.

**Consequences:**
- `claude` not found errors
- Working directory is wrong (Windows path vs WSL path)
- Environment variables from WSL `.bashrc`/`.zshrc` not loaded
- Signals (Ctrl+C) may not propagate correctly through the `wsl.exe` layer
- Path conversion needed: `D:\project` -> `/mnt/d/project`

**Prevention:**
1. Detect whether Claude Code is available natively or via WSL
2. If WSL, spawn `wsl.exe` as the shell with proper arguments:
```javascript
// Spawning Claude Code via WSL
const wslPath = convertToWslPath(projectDir); // D:\foo -> /mnt/d/foo
const pty = nodePty.spawn('wsl.exe', ['-e', 'bash', '-lic', `cd "${wslPath}" && claude`], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: projectDir,
  env: process.env
});
```
3. Use `-l` (login shell) to ensure `.bashrc`/`.profile` are sourced (which set up PATH, nvm, etc.)
4. Test signal propagation: Ctrl+C should interrupt Claude Code, not kill `wsl.exe`

**Detection:** If `claude` gives "command not found", or the working directory inside the session shows a Windows path instead of a WSL path, or Ctrl+C kills the whole session instead of interrupting Claude Code.

**Phase:** Phase 1 (PoC). This is the fundamental "can we even spawn Claude Code?" question. The WSL bridge is specific to this project's Windows-primary constraint.

---

### Pitfall 9: WebSocket Binary vs Text Frame Confusion

**What goes wrong:** PTY output is binary data (Buffer) containing UTF-8 with embedded ANSI escape sequences. WebSocket messages can be sent as binary or text frames. Mismatched encoding between server send and client receive causes garbled output, especially with multi-byte Unicode characters (emoji in Claude Code output, non-ASCII paths).

**Why it happens:** `node-pty` emits data as Buffers or strings depending on configuration. WebSocket libraries default to different frame types. If the server sends binary but the client interprets as text (or vice versa), encoding breaks.

**Prevention:**
1. Configure `node-pty` with `encoding: 'utf8'` to receive strings
2. Send as text WebSocket frames (not binary)
3. On the client, ensure `ws.binaryType` is set correctly if using binary
4. Test with emoji and non-ASCII content early

```javascript
// Server: node-pty configured for UTF-8 string output
const pty = nodePty.spawn(shell, args, {
  encoding: 'utf8',  // Receive strings, not Buffers
  // ...
});

pty.onData((data) => {
  // data is a string -- send as text frame
  for (const ws of session.wsConnections) {
    ws.send(data);
  }
});
```

**Detection:** Emoji or non-ASCII characters appear as `???` or `\ufffd` replacement characters. Occasional garbled output that looks like encoding corruption.

**Phase:** Phase 1 (PoC). Set encoding correctly from the start.

---

### Pitfall 10: Scrollback Buffer Memory Leak

**What goes wrong:** The server buffers session output for reconnection (Pitfall 6). Long-running Claude Code sessions can produce megabytes of output. Without limits, the buffer grows unbounded, eventually exhausting server memory -- especially when multiple sessions are active.

**Why it happens:** Developers implement the buffer as an array (`push()` every chunk) and forget to cap it. Claude Code sessions with heavy code generation or verbose tool output can produce substantial data.

**Prevention:**
1. Use a ring buffer or capped array (e.g., keep last 500KB per session)
2. Alternatively, write overflow to a temp file and keep only the tail in memory
3. Monitor buffer size and log warnings when approaching limits
4. On session close, immediately free the buffer

```javascript
class SessionBuffer {
  constructor(maxBytes = 512 * 1024) { // 512KB default
    this.chunks = [];
    this.totalBytes = 0;
    this.maxBytes = maxBytes;
  }

  push(data) {
    const bytes = Buffer.byteLength(data);
    this.chunks.push(data);
    this.totalBytes += bytes;
    while (this.totalBytes > this.maxBytes && this.chunks.length > 1) {
      const removed = this.chunks.shift();
      this.totalBytes -= Buffer.byteLength(removed);
    }
  }
}
```

**Detection:** Monitor Node.js process memory (`process.memoryUsage().heapUsed`). If it grows steadily during a session and never decreases, the buffer is leaking.

**Phase:** Phase 2 (Core). PoC can use a simple unbounded array for the short term, but Core must cap it.

---

## Minor Pitfalls

### Pitfall 11: Missing TERM Environment Variable

**What goes wrong:** The `TERM` environment variable in the PTY is not set or set to a value that doesn't match xterm.js capabilities. Claude Code checks `TERM` to decide what escape sequences to use. If it's `dumb` or missing, rich output is disabled.

**Prevention:** Set `name: 'xterm-256color'` in node-pty spawn options (this sets `TERM`). Verify `COLORTERM=truecolor` is also set if Claude Code supports 24-bit color.

**Phase:** Phase 1 (PoC). One-line fix.

---

### Pitfall 12: Port Conflicts on Multiple Project Instances

**What goes wrong:** If two Wingman instances try to bind the same port, the second one fails with `EADDRINUSE`. Error message is confusing to users who don't know another instance is running.

**Prevention:**
1. Default port + fallback: try port 3000, if taken try 3001, etc.
2. Or use port 0 (OS assigns a free port) and display the URL
3. The PID lock file (Pitfall 2) should also record the port
4. On duplicate detection, open the existing instance's URL instead of failing

**Phase:** Phase 2 (Core). PoC can use a fixed port.

---

### Pitfall 13: Browser Tab Lifecycle Confusion

**What goes wrong:** Users expect closing a browser tab to end the Claude session. But the PTY keeps running on the server. Users also expect opening a new tab to start a fresh session, but it should reconnect to the existing one. The expected behavior is unintuitive and must be explicitly designed.

**Prevention:**
- Document the mental model: "Closing the tab detaches from the session; the session keeps running. Reopen to reconnect."
- Provide explicit "End Session" button in the UI
- Consider a session timeout for detached sessions (e.g., 30 minutes without a connected client)
- Show session status in Mission Control (running/detached/ended)

**Phase:** Phase 2 (Core). Part of the session management design.

---

### Pitfall 14: Losing Ctrl+C and Other Special Key Sequences

**What goes wrong:** Special key combinations (Ctrl+C for SIGINT, Ctrl+D for EOF, Ctrl+Z for SIGTSTP, arrow keys for history) are captured by the browser or xterm.js but not correctly forwarded to the PTY.

**Why it happens:** Browsers intercept certain key combinations for their own purposes (Ctrl+W closes tab, Ctrl+N opens new window). xterm.js handles most terminal keybindings correctly, but custom key handlers or event.preventDefault() calls can interfere.

**Prevention:**
1. Do not add custom keyboard handlers that intercept terminal keys
2. xterm.js `term.onData()` already translates Ctrl+C to `\x03`, arrow keys to escape sequences, etc. -- trust it
3. Test all critical key combinations: Ctrl+C, Ctrl+D, Ctrl+Z, Tab (completion), arrow keys, Home/End
4. Consider using xterm.js `attachCustomKeyEventHandler` only for browser-level shortcuts you explicitly need (e.g., Ctrl+Shift+C for copy)

**Detection:** Ctrl+C does not interrupt a running command. Arrow keys print `^[[A` instead of navigating history. Tab completion doesn't work.

**Phase:** Phase 1 (PoC). Must verify these work during initial integration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: PoC Process Spawning | PTY vs Pipe (P1), Windows/WSL Path (P8) | Use node-pty from day one; build WSL bridge immediately |
| Phase 1: PoC Browser Rendering | ANSI Handling (P4), Input Echo (P7) | Use xterm.js, no local echo, test with Claude Code's rich output |
| Phase 1: PoC Basic I/O | Resize (P5), TERM var (P11), Key sequences (P14) | Set xterm-256color, wire up resize, test Ctrl+C |
| Phase 2: Session Management | Zombie Processes (P2), Reconnection (P6) | Process registry + cleanup handlers; scrollback buffer with replay |
| Phase 2: Multi-Session | Memory Leak (P10), Port Conflicts (P12) | Ring buffer per session; dynamic port allocation |
| Phase 2: UX Polish | Tab Lifecycle (P13) | Explicit End Session button; session timeout for detached |
| Distribution: npx | node-pty Build (P3) | Prebuild binaries; clear prerequisite docs |

## Windows/WSL-Specific Pitfall Summary

These pitfalls are uniquely amplified by the Windows + WSL architecture:

1. **node-pty on Windows uses ConPTY** -- newer and less battle-tested than Unix PTY. ConPTY has known quirks with certain escape sequences and resize handling. Test thoroughly.
2. **WSL process tree** -- killing `wsl.exe` may not kill processes inside WSL. Use `wsl --terminate` or send signals through the WSL shell.
3. **Path translation** -- every file path exchanged between Wingman (Windows-native Node.js) and Claude Code (WSL) must be converted. `D:\project` becomes `/mnt/d/project`. Get this wrong and Claude Code operates in the wrong directory.
4. **Line endings** -- PTY output from WSL uses `\n` but some Windows components expect `\r\n`. xterm.js handles this correctly, but any intermediate processing must preserve line endings.
5. **WSL startup latency** -- first WSL invocation after boot takes 2-5 seconds. Subsequent invocations are fast. The PoC should handle this gracefully (show "Starting WSL..." rather than appearing frozen).

## Sources

- Training data knowledge of xterm.js, node-pty, and WebSocket terminal patterns (MEDIUM confidence)
- Patterns observed in projects: ttyd, Wetty, code-server, Theia, VS Code remote terminal
- PROJECT.md requirements and constraints
- Note: Web search was unavailable during research. All pitfalls are based on well-established patterns in the browser terminal domain, but specific version details and recent API changes should be verified during implementation.
