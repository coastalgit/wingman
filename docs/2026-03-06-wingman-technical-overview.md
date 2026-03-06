# Wingman — Technical Overview

**Date:** 2026-03-06
**Version:** 2.0.0
**Status:** Functional prototype, active development

---

## What Wingman Does

Wingman is a **browser-based terminal manager for Claude Code sessions**. It lets you launch, monitor, and interact with multiple Claude Code CLI processes from a web UI — with a built-in prompt/context editor that injects text directly into the terminal.

The core idea: **a pseudo-terminal (PTY) runs on the server, and the browser renders it via xterm.js over WebSocket**. The user sees a fully interactive Claude Code terminal in their browser, plus editor panels for composing prompts and context that get piped into that terminal.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│  Browser (per session tab)                      │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Editor UI   │  │ xterm.js terminal         │  │
│  │ (prompt /   │  │ (renders PTY output,      │  │
│  │  context)   │  │  sends keystrokes back)   │  │
│  └──────┬──────┘  └────────────┬─────────────┘  │
│         │ REST API             │ WebSocket       │
└─────────┼──────────────────────┼────────────────┘
          │                      │
┌─────────┼──────────────────────┼────────────────┐
│  Node.js Server (Express + ws)                   │
│         │                      │                 │
│  ┌──────▼──────┐  ┌───────────▼──────────────┐  │
│  │ Session     │  │ node-pty                  │  │
│  │ Manager     │  │ (spawns bash → claude)    │  │
│  │ (registry,  │  │                           │  │
│  │  files)     │  │ PTY process per session   │  │
│  └─────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

**Stack:** Node.js, Express, `node-pty`, `ws` (WebSocket), xterm.js (browser terminal emulator).

---

## The PTY + WebSocket Pipe — How It Works

This is the core technical concept. The system creates a **bidirectional pipe** between a server-side pseudo-terminal and a browser-rendered terminal:

### 1. Spawning the PTY (server-side)

When a user creates a session, the server spawns a real pseudo-terminal using `node-pty`:

```js
const ptyProcess = pty.spawn(BASH_PATH, ['-c', 'claude'], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd: process.cwd(),
  env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
});
```

This creates a genuine PTY — the same thing a desktop terminal emulator uses. The process it runs is `bash -c 'claude'`, which launches Claude Code CLI inside Git Bash on Windows. The PTY handles all ANSI escape sequences, cursor movement, colors, line editing — everything a real terminal does.

### 2. PTY Output → WebSocket → Browser (server → client)

Every byte the PTY emits gets broadcast over WebSocket to all connected browser tabs for that session:

```js
ptyProcess.onData((data) => {
  // Buffer for replay (reconnection)
  sessionManager.addToHistory(sessionId, data);

  // Broadcast to all browser tabs watching this session
  wss.clients.forEach((client) => {
    if (client.sessionId === sessionId) {
      client.send(JSON.stringify({ type: 'output', data }));
    }
  });
});
```

The browser receives this and writes it into **xterm.js**, which is a full terminal emulator in the browser. It processes all the ANSI escape sequences, renders colors, handles cursor positioning — the user sees exactly what they'd see in a native terminal.

### 3. Browser Keystrokes → WebSocket → PTY (client → server)

On the browser side, xterm.js captures every keystroke and sends it back to the server:

```js
// Browser: xterm.js captures input
term.onData((data) => {
  ws.send(JSON.stringify({ type: 'input', data }));
});

// Server: routes input to the PTY
if (msg.type === 'input') {
  session.ptyProcess.write(msg.data);
}
```

The PTY receives these bytes exactly as if they were typed on a physical keyboard. Claude Code sees normal terminal input — it has no idea it's running inside a browser.

### 4. Terminal Resize Sync

When the browser window resizes, xterm.js recalculates how many columns/rows fit. This gets sent to the server, which resizes the PTY to match:

```js
// Browser: detect resize
fitAddon.fit();
ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));

// Server: resize the PTY
session.ptyProcess.resize(msg.cols, msg.rows);
```

Only the "primary" client (first tab connected) controls resize, preventing multiple tabs from fighting over terminal dimensions.

---

## Injecting Prompts Into the Terminal

This is where Wingman goes beyond a simple web terminal. The UI has editor panels where you compose prompts and context in markdown. When you click "Send", the text is **written directly into the PTY's stdin**:

```js
// Server: inject prompt text into the PTY
session.ptyProcess.write('\x15' + text + '\r');
```

- `\x15` = Ctrl+U (clears any pending input on the line)
- Then the prompt text is "typed" character by character
- `\r` = Enter (submits the prompt)

From Claude Code's perspective, someone just typed the prompt and hit Enter. The text appears in the terminal output, the user can see exactly what was sent, and Claude processes it normally.

For **context injection**, it uses slash commands:
```js
session.ptyProcess.write('\x15/ccc');  // types the /ccc slash command
setTimeout(() => session.ptyProcess.write('\r'), 50);  // Enter after brief delay
```

The `/ccc` slash command is a Claude Code custom command (installed by Wingman into `.claude/commands/ccc.md`) that tells Claude to read the context file from disk.

---

## Session Management

### Lifecycle

Sessions go through these states:

| State | Meaning |
|-------|---------|
| `active` | PTY is running, Claude is live |
| `reconnectable` | PTY exited but session metadata preserved — can respawn |
| `closed` | Permanently ended |

### Persistence

Each session is stored as a JSON file at `.ai/wingman/sessions/<uuid>.json`:
```json
{
  "id": "uuid",
  "description": "user-provided label",
  "createdAt": "ISO timestamp",
  "closed": false,
  "promptHistory": [...],
  "contextText": "..."
}
```

Terminal output is kept in an **in-memory circular buffer** (10,000 chunks). When a new browser tab connects (or reconnects), the full buffer is replayed through xterm.js so the terminal shows the correct state — all escape sequences are re-processed in order.

### Multi-Tab Support

Multiple browser tabs can view the same session simultaneously. All tabs receive the same PTY output. Only the primary tab (first to connect) controls terminal resize. Any tab can send input.

---

## Mission Control

Mission Control is the dashboard at `/` that:
- Lists all sessions with their status (active / reconnectable / stopped)
- Launches new sessions (each opens in a new browser window)
- Stops or deletes sessions
- Receives real-time updates via WebSocket (`session-update` messages)

It uses a separate WebSocket message type (`mc-connect`) so the server knows to send session list updates to Mission Control clients, not terminal output.

---

## File Layout on Disk

Wingman creates its state files in the project directory:

```
project-root/
  .ai/wingman/
    cprompt.md          ← active prompt (written by UI, read by /ccp command)
    ccontext.md         ← active context (written by UI, read by /ccc command)
    wingman.json        ← config (templates, settings)
    wingman.pid         ← process lock file (port + PID)
    sessions/
      <uuid>.json       ← per-session metadata + prompt history
  .claude/commands/
    ccp.md              ← slash command: "read cprompt.md and execute it"
    ccc.md              ← slash command: "read ccontext.md and absorb it"
```

The **slash commands are the bridge** between the file-based prompt system and Claude Code. When Wingman writes a prompt to `cprompt.md` and then types `/ccp` into the PTY, Claude Code's slash command system reads the file and treats its contents as instructions.

---

## Key Technical Decisions

1. **node-pty over raw child_process**: `child_process.spawn` doesn't create a PTY — you get stdout/stderr pipes but no terminal emulation. Claude Code (and most interactive CLI tools) detect they're not in a TTY and change behavior — no colors, no interactive UI, different output format. `node-pty` creates a real pseudo-terminal so Claude Code behaves identically to running in a desktop terminal.

2. **ConPTY on Windows**: Windows 10+ has ConPTY (Console Pseudo Terminal), which `node-pty` uses. This is what makes the whole approach viable on Windows. The PTY spawns Git Bash, which runs Claude CLI.

3. **xterm.js for rendering**: Rather than parsing ANSI escape sequences ourselves, xterm.js is a complete terminal emulator. It handles all of VT100/VT220/xterm escape sequences, 256 colors, true color, cursor movement, scrollback, selection, etc.

4. **History replay for reconnection**: Instead of trying to serialize terminal state, we replay all raw PTY output chunks through xterm.js. The terminal emulator processes them in sequence and arrives at the correct visual state. Simple and reliable.

5. **File-based prompt bridge**: Instead of trying to intercept or modify Claude Code's input handling, we use its own slash command system. Write text to a file, trigger the slash command via PTY input. Claude Code reads the file through its own mechanisms. Zero coupling to Claude Code internals.

6. **OS-assigned port (port 0)**: The server binds to port 0 by default, letting the OS pick a free port. This means multiple Wingman instances in different project directories never conflict. The actual port is written to the PID lock file.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server, REST API, static file serving |
| `node-pty` | Pseudo-terminal spawning (native addon, uses ConPTY on Windows) |
| `ws` | WebSocket server for real-time PTY I/O and session updates |
| `open` | Opens the browser on startup |
| `xterm.js` (CDN) | Browser-side terminal emulator |
| `xterm-addon-fit` (CDN) | Auto-sizes terminal to container |
| `xterm-addon-web-links` (CDN) | Clickable URLs in terminal output |

---

## Running It

```bash
# From the project directory you want to manage:
npx wingman          # starts server, opens Mission Control in browser
npx wingman --port 3000   # fixed port
npx wingman --manual      # no Claude sessions, just file editing
```

Mission Control opens at `http://localhost:<port>`. Click "+" to launch a Claude Code session. Each session opens in its own browser tab with the terminal + editor panels.
