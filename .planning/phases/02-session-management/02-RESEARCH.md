# Phase 2: Session Management - Research

**Researched:** 2026-03-04
**Domain:** Node.js WebSocket session lifecycle, PTY process management, terminal history persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints

No CONTEXT.md provided for Phase 2. Research assumes standard practices from Phase 1 locked decisions:
- Node.js server continues to spawn PTY via node-pty
- WebSocket (ws) library for browser-PTY bridging
- xterm.js for browser terminal rendering
- No Mission Control in this phase (Phase 3)
- File-based JSON session storage (no external database)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | Each `npx wingman` session has a unique ID stored in `.ai/wingman/sessions.json` | UUID v4 generation via crypto.randomUUID(); session metadata structure in JSON file |
| SESS-02 | Closing and reopening a session browser tab reconnects to the same running Claude process with full history replayed | WebSocket session ID mapping; terminal history buffer persistence; reconnection logic with state recovery |
| SESS-03 | Server maintains a scrollback buffer per session for history replay on reconnect | In-memory circular buffer pattern; xterm.js native scrollback + server-side transcript storage |
| SESS-04 | Individual session can be gracefully closed (terminates Claude child process, marks session closed) | PTY onExit handler; process signal handling (SIGTERM); mark session as closed in sessions.json without removing it |
| SESS-05 | Session metadata visible in browser window (session ID, project name, Mission Control port) | Metadata transmitted in initial WebSocket handshake; browser displays in UI (title bar or status area) |

</phase_requirements>

---

## Summary

Phase 2 layers session management onto the Phase 1 PTY pipe, enabling multiple independent Claude Code sessions and reconnection without losing history. The architecture is straightforward: assign each session a UUID on spawn, maintain a session registry in `.ai/wingman/sessions.json`, and implement a reconnection handler that restores the prior session's PTY process and replays terminal history when a browser tab reconnects.

The core challenge is **session state recovery** — the server must map a reconnecting client's session ID back to its running PTY process, send the accumulated terminal history, and resume streaming new output. This is distinct from "connection state recovery" (a Socket.IO feature for message queuing); Phase 2 implements custom session tracking because the Phase 1 stack uses raw `ws`, not Socket.IO.

The two key components are:
1. **Session registry** (`.ai/wingman/sessions.json`) — tracks active/closed sessions with metadata (ID, createdAt, port, closed: true/false)
2. **Terminal history buffer** (in-memory per PTY) — stores recent terminal output; on reconnect, server streams the buffer first, then resumes live output

**Primary recommendation:** Implement a SessionManager class that tracks all PTY processes by session ID, manages the sessions.json file (read on startup, update on spawn/close), stores terminal history in a per-session circular buffer (5000-10000 lines), and handles reconnection by looking up the session ID and sending buffered history before resuming live output.

---

## Standard Stack

### Core (Additions to Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| crypto (Node.js built-in) | v20+ | Generate UUID v4 session IDs | Built-in since Node 14.17.0; no external dependency; RFC 4122 compliant |
| fs (Node.js built-in) | v20+ | Read/write `.ai/wingman/sessions.json` | Standard file I/O; JSON.parse/stringify for session metadata |

### Patterns from Phase 1 (Unchanged)

| Library | Version | Purpose |
|---------|---------|---------|
| node-pty | 1.1.0 | Spawn and manage Claude Code PTY processes (Phase 1) |
| ws | 8.19.0 | WebSocket server for browser-PTY communication (Phase 1) |
| @xterm/xterm | 6.0.0 | Browser terminal rendering (Phase 1) |
| express | 4.21.0 | HTTP server for index.html (Phase 1) |

### Supporting (Optional Enhancements for Phase 2)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.x | Shorter, URL-friendly session IDs (alternative to UUID) | If Phase 3 mission-control URLs need compact IDs; UUID works fine for Phase 2 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| crypto.randomUUID() | uuid npm package | uuid package supports multiple versions (v1, v3, v5, v6); crypto.randomUUID() is simpler, built-in, no dependency |
| File-based sessions.json | SQLite or Redis | File-based is adequate for single-machine development; distributed session store needed for multi-instance production |
| In-memory terminal history | RocksDB or LevelDB | In-memory is simple for Phase 2 PoC; persistence to disk needed if sessions must survive server restart |

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 Additions)

```
wingman/
├── server.js              # Entry point (Phase 1); extended with SessionManager in Phase 2
├── lib/
│   └── session-manager.js # NEW: SessionManager class tracking PTY processes + history
├── package.json
├── public/
│   ├── index.html         # Existing (Phase 1)
│   ├── terminal.js        # Existing (Phase 1); extended with session ID handshake
│   └── styles.css         # Existing (Phase 1)
├── .ai/
│   └── wingman/
│       └── sessions.json  # NEW: Session registry (created on first spawn)
└── .gitignore
```

Phase 2 adds `lib/session-manager.js` (session tracking) and `.ai/wingman/` directory (session metadata).

### Pattern 1: SessionManager Class

**What:** A singleton class that manages all active PTY processes, maps session IDs to PTY objects, stores terminal history per session, and provides methods for spawn, reconnect, and close.

**When to use:** Every server.js instance needs exactly one SessionManager to track active sessions.

**Implementation sketch:**

```javascript
// lib/session-manager.js
// Source: custom pattern, informed by node-pty + Socket.IO multi-user examples

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SessionManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.sessionsDir = path.join(projectRoot, '.ai', 'wingman');
    this.sessionsFile = path.join(this.sessionsDir, 'sessions.json');

    // In-memory tracking: sessionId -> { ptyProcess, history, createdAt, ... }
    this.sessions = new Map();

    // Ensure .ai/wingman directory exists
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    // Load existing sessions from disk on startup
    this.loadSessionsFromDisk();
  }

  // Generate unique session ID
  generateSessionId() {
    return crypto.randomUUID();
  }

  // Create a new session with a spawned PTY
  spawnSession(ptyProcess, metadata = {}) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      ptyProcess,
      history: [], // Circular buffer of terminal output
      closed: false,
      ...metadata,
    };
    this.sessions.set(sessionId, session);
    this.updateSessionsFile();
    return sessionId;
  }

  // Retrieve session by ID (for reconnect)
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // Add terminal output to session history
  addToHistory(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.history.push(data);
      // Keep history size bounded (e.g., last 10000 lines)
      if (session.history.length > 10000) {
        session.history.shift();
      }
    }
  }

  // Get buffered history for a session (for replay on reconnect)
  getHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.history : [];
  }

  // Close a session gracefully
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.closed = true;
      // Don't remove from memory; Phase 3 may show closed sessions
      this.updateSessionsFile();
    }
  }

  // Write session metadata to disk (sessions.json)
  updateSessionsFile() {
    const metadata = Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      closed: s.closed,
    }));
    fs.writeFileSync(this.sessionsFile, JSON.stringify(metadata, null, 2));
  }

  // Load sessions from disk on startup (restore closed session list)
  loadSessionsFromDisk() {
    if (fs.existsSync(this.sessionsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
        // Note: we only restore metadata; PTY processes are spawned fresh
        // (closed sessions are loaded so Phase 3 can show history)
        data.forEach(s => {
          if (!this.sessions.has(s.id)) {
            this.sessions.set(s.id, {
              ...s,
              ptyProcess: null,
              history: [],
            });
          }
        });
      } catch (err) {
        console.error('Failed to load sessions.json:', err);
      }
    }
  }
}

module.exports = SessionManager;
```

### Pattern 2: WebSocket Reconnection Handshake

**What:** When a browser connects or reconnects, it sends its session ID. The server looks up the session, sends buffered history, then subscribes to live PTY output.

**Critical rules:**
1. On initial connect: send empty history, spawn new PTY, generate session ID
2. On reconnect: send buffered history first (replay), then live output
3. Mark the session in browser title/status so user sees: "Session: abc-123..."

**Message protocol extension (Phase 1 → Phase 2):**

Browser → Server:
```json
{ "type": "handshake", "sessionId": "uuid-or-null" }
{ "type": "input", "data": "text" }
{ "type": "resize", "cols": 120, "rows": 30 }
```

Server → Browser:
```json
{ "type": "handshake-ack", "sessionId": "uuid", "history": [...] }
{ "type": "output", "data": "text" }
{ "type": "session-ended" }
{ "type": "session-metadata", "id": "uuid", "createdAt": "ISO8601", "closed": false }
```

**Implementation in server.js:**

```javascript
wss.on('connection', (ws) => {
  let sessionId = null;

  ws.on('message', (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      if (msg.type === 'handshake') {
        // Client indicates which session it's reconnecting to
        sessionId = msg.sessionId;

        if (sessionId && sessionManager.getSession(sessionId)) {
          // Reconnect to existing session
          const session = sessionManager.getSession(sessionId);
          if (session.closed) {
            ws.send(JSON.stringify({
              type: 'handshake-ack',
              sessionId,
              status: 'closed',
              history: sessionManager.getHistory(sessionId),
            }));
          } else {
            // Send buffered history
            const history = sessionManager.getHistory(sessionId);
            ws.send(JSON.stringify({
              type: 'handshake-ack',
              sessionId,
              status: 'resumed',
              history,
            }));
            // Re-attach PTY listener
            attachPtyToWebSocket(session, ws, sessionId);
          }
        } else {
          // New session — spawn PTY, generate ID
          const newSessionId = sessionManager.generateSessionId();
          const pty = pty.spawn(BASH_PATH, ['-c', 'claude'], {...});
          sessionManager.spawnSession(pty, { sessionId: newSessionId });
          sessionId = newSessionId;

          ws.send(JSON.stringify({
            type: 'handshake-ack',
            sessionId: newSessionId,
            status: 'new',
            history: [],
          }));
          attachPtyToWebSocket(sessionManager.getSession(newSessionId), ws, newSessionId);
        }
      }

      if (msg.type === 'input') {
        const session = sessionManager.getSession(sessionId);
        if (session) session.ptyProcess.write(msg.data);
      }
      // ... handle resize, etc.
    } catch (e) {
      console.error('Bad message:', e);
    }
  });
});

function attachPtyToWebSocket(session, ws, sessionId) {
  const dataHandler = session.ptyProcess.onData((data) => {
    // Store in history for future reconnects
    sessionManager.addToHistory(sessionId, data);

    // Send to browser
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  ws.on('close', () => {
    dataHandler.dispose();
  });
}
```

### Pattern 3: Session Metadata Display

**What:** Browser receives session ID and metadata on handshake, displays it in the terminal UI (title bar, status bar, or info overlay).

**Example HTML + JS:**

```html
<!-- In index.html: add metadata display -->
<div id="session-info">
  Session: <span id="session-id">loading...</span>
  | Created: <span id="session-created">loading...</span>
</div>
```

```javascript
// In terminal.js: on handshake-ack
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'handshake-ack') {
    document.getElementById('session-id').textContent = msg.sessionId;
    document.getElementById('session-created').textContent = new Date(msg.sessionId.createdAt).toLocaleString();

    // Replay history
    msg.history.forEach(line => term.write(line));
  }
  // ... handle output, etc.
};
```

### Pattern 4: Graceful Session Close

**What:** When user requests to close a session (button or Ctrl+D), the server marks it closed, terminates the PTY, and optionally keeps metadata for Phase 3 (Mission Control can show closed sessions).

**Implementation:**

```javascript
// In server.js SIGINT handler (Ctrl+C in terminal)
process.on('SIGINT', () => {
  console.log('\nShutting down...');

  // Close all sessions gracefully
  sessionManager.sessions.forEach((session, sessionId) => {
    if (session.ptyProcess) {
      session.ptyProcess.kill();
    }
    sessionManager.closeSession(sessionId);
  });

  // Close WebSocket connections
  wss.clients.forEach((ws) => ws.terminate());

  // Exit
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
});
```

### Anti-Patterns to Avoid

- **No in-memory session persistence without backup:** If server restarts, in-memory history is lost. Phase 2 is okay with this (PoC); Phase 3 may add persistence.
- **No shared PTY across browsers:** Each session has exactly one PTY process. Multiple browsers connecting to the same session ID receive the same output but don't share stdin (avoid colliding keystrokes).
- **Don't discard session metadata on close:** Keep closed sessions in `.ai/wingman/sessions.json` for Phase 3 (Mission Control shows them). Just mark `closed: true`.
- **Don't rely on browser sessionStorage for session ID:** Use query params (e.g., `?sessionId=uuid`) or localStorage so the session ID persists across browser tab reopen. Better: server tracks the last session per client via HTTP cookies (Phase 3).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID v4 generation | Custom random string logic | crypto.randomUUID() (Node 14.17.0+) | RFC 4122 compliant; built-in; no dependency. Custom logic risks collisions. |
| Terminal history buffer | Unbounded array | Circular buffer (fixed size, FIFO overflow) | Unbounded history exhausts memory. Circular buffer (e.g., last 10000 lines) is standard. |
| Session persistence | In-memory only | JSON file + in-memory map | File backup survives server restart. Phase 3+ may add SQLite. |
| Connection state recovery | Custom message queue | WebSocket handshake + history replay | Phase 1 uses raw ws (not Socket.IO). Custom handshake is simpler than Socket.IO migration. |

**Key insight:** Session management is domain-specific (terminal sessions, not HTTP sessions). Don't import express-session or Socket.IO features meant for different use cases. Custom SessionManager is the right abstraction.

---

## Common Pitfalls

### Pitfall 1: Reconnecting Client Gets Old PTY Process Still Alive on Server

**What goes wrong:** Browser closes, user reopens the session URL. Server looks up the session ID but the original PTY process is still running (not killed). Two browsers appear to "share" a PTY, causing input collision and unexpected output routing.

**Why it happens:** Sessions are disconnected from browsers asynchronously. When a browser closes (WebSocket close event), the server doesn't immediately know if the user will reconnect. Killing the PTY on every disconnect breaks reconnection.

**How to avoid:**
- Decouple WebSocket lifetime from PTY lifetime. One PTY process can serve multiple WebSocket connections to the same session.
- On WebSocket close, remove the browser from the session's client list but do NOT kill the PTY.
- Only kill the PTY when the user explicitly closes the session (e.g., `/exit` or "Close Session" button) or the PTY exits naturally (Claude Code terminates).

**Warning signs:** Multiple browser tabs/windows connected to the same session; typing in one affects the other unexpectedly.

---

### Pitfall 2: History Buffer Grows Unbounded and Exhausts Memory

**What goes wrong:** Server stores all terminal output in an array. After hours of Claude Code running, memory usage climbs to 100MB+, eventually killing the process.

**Why it happens:** The history buffer is appended to with every PTY output event (dozens per second) but never trimmed.

**How to avoid:**
- Use a fixed-size circular buffer (e.g., keep only the last 10000 lines).
- When history.length exceeds the limit, remove the oldest entry: `history.shift()`.
- Document the limit in comments: `// Circular buffer: keep last 10000 lines for reconnect replay`.

**Warning signs:** Server memory increases linearly over time; `/top` or `ps aux` shows Node process using 100+ MB.

---

### Pitfall 3: Session ID Not Persisted Across Browser Reopens

**What goes wrong:** User closes browser tab, reopens localhost:7891 in a new tab. Browser has no session ID (lost), so server treats it as a new session. Old session still running (orphaned) invisible.

**Why it happens:** Session ID is generated on first connect but not stored anywhere the browser can retrieve it on page reload.

**How to avoid:**
- Store session ID in browser `localStorage` or `sessionStorage` on handshake, then send it back in the next handshake.
- Alternatively, include session ID in the URL query string: `http://localhost:7891?sessionId=abc-123`. Browser refresh preserves it.
- Browser-side code: `localStorage.setItem('wingmanSessionId', msg.sessionId)` on handshake; on reconnect, send `localStorage.getItem('wingmanSessionId')`.

**Warning signs:** Close a tab mid-session, reopen the page, see a fresh terminal (no history). Old session still running invisibly.

---

### Pitfall 4: sessions.json Becomes Huge or Corrupted

**What goes wrong:** sessions.json grows to megabytes after many session spawn/close cycles. Or, if server crashes during a write, the file is half-written and subsequent reads fail.

**Why it happens:** No cleanup of old sessions; no atomic write (file corruption on crash).

**How to avoid:**
- Phase 2: Write sessions.json only when sessions are spawned or closed (not on every output event).
- Phase 3: Implement cleanup (archive or delete sessions older than N days).
- For robustness: write to a temp file first, then atomically rename (fs.renameSync). This prevents half-written corruption.
- Example: `fs.writeFileSync(tmpFile, json); fs.renameSync(tmpFile, finalFile);`

**Warning signs:** sessions.json >10MB; "Cannot parse sessions.json" errors after abrupt shutdown.

---

### Pitfall 5: No Timeout or Cleanup for Long-Disconnected Sessions

**What goes wrong:** User closes browser, forgets about the session, comes back a week later. Server still has old PTY process running consuming memory/CPU.

**Why it happens:** No logic to detect and clean up stale sessions.

**How to avoid:**
- Phase 2: Not critical (PoC). Document as a gap.
- Phase 3: Implement session inactivity timeout (e.g., kill PTY if no WebSocket connection for 60 minutes).
- Track `lastConnectedAt` on each session, check on Mission Control startup, offer "clean up stale sessions" action.

**Warning signs:** `/ai/wingman/sessions.json` lists dozens of old sessions; `ps aux` shows orphaned bash/claude processes.

---

### Pitfall 6: Circular History Buffer Doesn't Account for ANSI Escape Sequences

**What goes wrong:** Terminal history buffer stores ANSI sequences as individual lines. On replay, xterm.js processes them correctly, but if you naively log or display the buffer in a non-terminal context, raw escape codes appear (e.g., `^[[32m` for green text).

**Why it happens:** PTY output includes raw ANSI escape sequences. If you split by newline to count lines, you might count escape sequences as lines.

**How to avoid:**
- Store the raw PTY output as-is (no parsing).
- Replay by sending raw data to xterm.js (which knows how to parse it).
- Don't try to "clean" or interpret the ANSI sequences in the buffer.
- History size in "bytes" or "events" rather than "lines" if line boundaries are unclear.

**Warning signs:** History shows `^[[32m` or `\x1b[32m` instead of colours when displayed outside xterm.js.

---

## Code Examples

Verified patterns from official sources and working multi-session terminal projects.

### server.js: SessionManager Integration

Source: Custom pattern based on node-pty + Socket.IO multi-user examples from Medium article

```javascript
// server.js (Phase 2 extension)
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const pty = require('node-pty');
const SessionManager = require('./lib/session-manager.js');

const PORT = process.env.PORT || 7891;
const BASH_PATH = process.env.WINGMAN_BASH_PATH
  || 'C:\\Program Files\\Git\\bin\\bash.exe';

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Initialize session manager (singleton)
const sessionManager = new SessionManager(process.cwd());

wss.on('connection', (ws) => {
  let sessionId = null;
  let dataHandler = null;

  ws.on('message', (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      if (msg.type === 'handshake') {
        // Reconnect or new session
        sessionId = msg.sessionId || null;

        if (sessionId && sessionManager.getSession(sessionId)) {
          // Existing session
          const session = sessionManager.getSession(sessionId);
          const history = sessionManager.getHistory(sessionId);

          ws.send(JSON.stringify({
            type: 'handshake-ack',
            sessionId,
            status: 'resumed',
            createdAt: session.createdAt,
            history,
          }));

          // Attach PTY to this connection
          if (session.ptyProcess) {
            dataHandler = session.ptyProcess.onData((data) => {
              sessionManager.addToHistory(sessionId, data);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'output', data }));
              }
            });
          }
        } else {
          // New session
          const newSessionId = sessionManager.generateSessionId();
          const ptyProcess = pty.spawn(BASH_PATH, ['-c', 'claude'], {
            name: 'xterm-256color',
            cols: 120,
            rows: 30,
            cwd: process.cwd(),
            env: {
              ...process.env,
              TERM: 'xterm-256color',
              COLORTERM: 'truecolor',
            },
          });

          sessionManager.spawnSession(ptyProcess, { sessionId: newSessionId });

          ws.send(JSON.stringify({
            type: 'handshake-ack',
            sessionId: newSessionId,
            status: 'new',
            createdAt: new Date().toISOString(),
            history: [],
          }));

          // Attach PTY to this connection
          dataHandler = ptyProcess.onData((data) => {
            sessionManager.addToHistory(newSessionId, data);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data }));
            }
          });

          // Notify all connected clients when this PTY exits
          ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`Session ${newSessionId}: PTY exited (code=${exitCode}, signal=${signal})`);
            sessionManager.closeSession(newSessionId);
            wss.clients.forEach((client) => {
              if (client.readyState === ws.OPEN) {
                client.send(JSON.stringify({ type: 'session-ended', sessionId: newSessionId }));
              }
            });
          });
        }
      }

      if (msg.type === 'input') {
        const session = sessionManager.getSession(sessionId);
        if (session && session.ptyProcess) {
          session.ptyProcess.write(msg.data);
        }
      }

      if (msg.type === 'resize') {
        const session = sessionManager.getSession(sessionId);
        if (session && session.ptyProcess) {
          session.ptyProcess.resize(msg.cols, msg.rows);
        }
      }
    } catch (e) {
      console.error('Bad message:', e);
    }
  });

  ws.on('close', () => {
    if (dataHandler) dataHandler.dispose();
  });

  ws.on('error', (err) => console.error('WebSocket error:', err));
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');

  // Kill all PTY processes
  sessionManager.sessions.forEach((session, sessionId) => {
    if (session.ptyProcess && !session.closed) {
      session.ptyProcess.kill();
      sessionManager.closeSession(sessionId);
    }
  });

  // Close all WebSocket connections
  wss.clients.forEach((ws) => ws.terminate());

  // Exit
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
});

server.listen(PORT, () => {
  console.log(`Wingman running at http://localhost:${PORT}`);
  import('open').then(({ default: open }) => open(`http://localhost:${PORT}`));
});
```

### terminal.js: Browser Reconnection Handshake

Source: Custom pattern for browser-side session recovery

```javascript
// public/terminal.js (Phase 2 extension)

const sessionId = localStorage.getItem('wingmanSessionId') || null;
const ws = new WebSocket('ws://' + location.host);

const term = new Terminal({
  cursorBlink: true,
  scrollback: 10000,
  theme: { background: '#0d1117', foreground: '#c9d1d9' },
  fontFamily: 'Cascadia Code, Fira Code, monospace',
  fontSize: 14,
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon.WebLinksAddon());
term.open(document.getElementById('terminal'));
fitAddon.fit();

// Send handshake on WebSocket open
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'handshake', sessionId }));
  fitAddon.fit();
  ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'handshake-ack') {
    // Store session ID in localStorage for future reconnects
    localStorage.setItem('wingmanSessionId', msg.sessionId);

    // Display session info
    document.title = `Wingman - Session ${msg.sessionId.substring(0, 8)}...`;
    const statusDiv = document.getElementById('session-info');
    if (statusDiv) {
      statusDiv.textContent = `Session: ${msg.sessionId} | Created: ${new Date(msg.createdAt).toLocaleString()}`;
    }

    // Replay history if reconnecting
    if (msg.history && msg.history.length > 0) {
      term.writeln('[Replaying session history...]');
      msg.history.forEach(line => term.write(line));
      term.writeln('[End of history]');
    }

    console.log(`Connected to session ${msg.sessionId} (${msg.status})`);
  }

  if (msg.type === 'output') {
    term.write(msg.data);
  }

  if (msg.type === 'session-ended') {
    term.writeln('\r\n[Session ended]');
  }
};

// Terminal input
term.onData((data) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', data }));
  }
});

// Terminal resize
let resizeTimeout;
const observer = new ResizeObserver(() => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    fitAddon.fit();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    }
  }, 50);
});
observer.observe(document.getElementById('terminal'));
```

### lib/session-manager.js: Full Implementation

Source: Custom SessionManager class (see Pattern 1 above for full code)

```javascript
// lib/session-manager.js
// Minimal circular buffer + file persistence

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SessionManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.sessionsDir = path.join(projectRoot, '.ai', 'wingman');
    this.sessionsFile = path.join(this.sessionsDir, 'sessions.json');
    this.sessions = new Map();
    this.historyLimit = 10000;

    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    this.loadSessionsFromDisk();
  }

  generateSessionId() {
    return crypto.randomUUID();
  }

  spawnSession(ptyProcess, metadata = {}) {
    const sessionId = this.generateSessionId();
    this.sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date().toISOString(),
      ptyProcess,
      history: [],
      closed: false,
      ...metadata,
    });
    this.updateSessionsFile();
    return sessionId;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  addToHistory(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.history.push(data);
      if (session.history.length > this.historyLimit) {
        session.history.shift();
      }
    }
  }

  getHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.history : [];
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.closed = true;
      this.updateSessionsFile();
    }
  }

  updateSessionsFile() {
    const metadata = Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      createdAt: s.createdAt,
      closed: s.closed,
    }));
    const tmpFile = this.sessionsFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(metadata, null, 2));
    fs.renameSync(tmpFile, this.sessionsFile);
  }

  loadSessionsFromDisk() {
    if (fs.existsSync(this.sessionsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
        data.forEach(s => {
          if (!this.sessions.has(s.id)) {
            this.sessions.set(s.id, {
              ...s,
              ptyProcess: null,
              history: [],
            });
          }
        });
      } catch (err) {
        console.error('Failed to load sessions.json:', err);
      }
    }
  }
}

module.exports = SessionManager;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plain HTTP for terminal | WebSocket persistent connection + PTY pipe | ~2015 VS Code integrated terminal | Enables real-time, low-latency terminal interaction. WebSocket standard on all browsers. |
| Terminal session lost on disconnect | WebSocket reconnection + history buffer | ~2020 Cloud IDEs (Gitpod, Code Server) | Users expect sessions to survive network blips and tab reopen. |
| express-session for all state | Custom session manager per domain | ~2022-2024 Microservices trend | express-session is for HTTP sessions (cookies). Terminal sessions are domain-specific; custom manager is cleaner. |
| Socket.IO for everything | Raw ws + custom handshake | ~2025 Lightweight architectures | Socket.IO adds features (rooms, namespaces, message queuing). Raw ws + custom handshake is sufficient for Phase 2 and simpler. |

**Deprecated/outdated:**
- **HTTP-only terminal:** No polling, no SSE for terminal output. WebSocket is the standard.
- **Stateless terminal sessions:** Modern terminals persist session history and state across disconnects.
- **Single session per server:** Modern terminals support multiple concurrent sessions (Tmux, Screen, Zellij).

---

## Open Questions

1. **Persistence across server restart**
   - What we know: Phase 2 stores session metadata in `.ai/wingman/sessions.json` and history in memory.
   - What's unclear: Should PTY processes survive a server restart (e.g., via `pm2 restart`)? Unlikely to be desired, but question for Phase 3.
   - Recommendation: Phase 2 treats server restart as graceful shutdown (all sessions close). Phase 3 may add session recovery (re-attach to orphaned PTY processes).

2. **Multi-user session access**
   - What we know: Phase 2 is single-developer local development (localhost:7891).
   - What's unclear: Can two browsers on different machines both access the same session? Should they (simultaneous keystroke conflicts)?
   - Recommendation: Phase 2 doesn't handle this. Phase 3 may add "broadcast" mode (shared view) or "exclusive" mode (one client at a time).

3. **Session ID transmission over HTTP (before WebSocket upgrade)**
   - What we know: Browser generates or retrieves session ID on page load, sends it in first WebSocket message.
   - What's unclear: Is this secure enough? Should we use HTTP cookies instead?
   - Recommendation: Phase 2 uses localStorage + query params. Phase 3 may add HTTP cookie with secure/SameSite flags if multi-tab support is needed.

4. **History buffer format (raw bytes vs. parsed ANSI)**
   - What we know: We store raw PTY output (including ANSI escape sequences) in the history buffer.
   - What's unclear: Should we parse and compress ANSI sequences to reduce memory? Or store as-is?
   - Recommendation: Phase 2 stores as-is (simpler). Phase 3 may add compression or transcript export (parsed/readable text).

---

## Validation Architecture

nyquist_validation is enabled (per `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project root |
| Config file | None — no jest.config, vitest.config, or test/ directory found |
| Quick run command | N/A — Phase 2 is interactive/smoke test only |
| Full suite command | N/A |

Phase 2 adds interactive features (session reconnection, history replay) that are inherently manual tests. Automated unit testing of SessionManager is possible but not critical for Phase 2 PoC.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | Session IDs generated and stored in sessions.json | unit | `node -e "const m=require('./lib/session-manager.js'); const s=new m(); const id=s.generateSessionId(); console.log(id.match(/^[0-9a-f\-]{36}$/) ? 'PASS' : 'FAIL')"` | Wave 0: lib/session-manager.js |
| SESS-02 | Browser reconnects and resumes with history | smoke | Open session, type message, close tab, reopen, verify history visible | Manual interactive |
| SESS-03 | History buffer stores and replays | unit | `node` REPL: create SessionManager, addToHistory, getHistory, verify array | Manual REPL |
| SESS-04 | Session close marks closed in sessions.json | smoke | Run server, connect, type /exit, check sessions.json for `"closed": true` | Manual inspection |
| SESS-05 | Metadata visible in browser | smoke | Open session, verify title/status shows session ID and timestamp | Manual visual |

All SESS requirements are interactive/visual. Definition of done: developer runs `node server.js`, browser opens, closes tab mid-session, reopens localhost:7891, sees session history, types a message to Claude Code.

### Sampling Rate

- **Per task commit:** Manual smoke test (spawn session, verify handshake, verify history)
- **Per wave merge:** Full interactive test (SESS-01 through SESS-05 all verified manually)
- **Phase gate:** Full interactive test green before moving to Phase 3

### Wave 0 Gaps

- [ ] `lib/session-manager.js` — SessionManager class with spawn/getSession/addToHistory/closeSession methods
- [ ] `.ai/wingman/sessions.json` — created by SessionManager on first spawn
- [ ] `server.js` — extended with SessionManager integration and handshake protocol
- [ ] `public/terminal.js` — extended with handshake message, history replay, session ID persistence in localStorage
- [ ] `public/index.html` — optional: add session info display (title, status bar)
- [ ] `package.json` — already has dependencies; no new npm packages needed for Phase 2

---

## Sources

### Primary (HIGH confidence)

- [Socket.IO Connection State Recovery (socket.io/docs/v4/connection-state-recovery)](https://socket.io/docs/v4/connection-state-recovery) — Pattern for session tracking and message queuing; Phase 2 implements custom version with ws
- [Node.js crypto.randomUUID() — RFC 4122 UUID v4 generation (node.js docs)](https://nodejs.org/api/crypto.html#crypto_crypto_randomuuid) — Built-in since 14.17.0; recommended for session ID generation
- [Efficient and Scalable Usage of Node.js PTY with Socket.io for Multiple Users (medium.com)](https://medium.com/@deysouvik700/efficient-and-scalable-usage-of-node-js-pty-with-socket-io-for-multiple-users-402851075c4a) — TerminalManager class pattern for multi-session PTY management
- [xterm.js scrollback buffer configuration (xtermjs.org)](https://xtermjs.org/) — Terminal scrollback: 10000 lines is documented standard

### Secondary (MEDIUM confidence)

- [WebSockets: The Complete Guide for 2026 (devtoolbox.dedyn.io)](https://devtoolbox.dedyn.io/blog/websocket-complete-guide) — Exponential backoff reconnection patterns; connection state management
- [How to Handle WebSocket Reconnection Logic (oneuptime.com)](https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view) — Reconnection strategies; heartbeat mechanisms
- [JSON File Storage in Node.js (github.com/flosse/json-file-store)](https://github.com/flosse/json-file-store) — File-based JSON session storage patterns
- [Node.js Graceful Shutdown (dev.to/yusadolat)](https://dev.to/yusadolat/nodejs-graceful-shutdown-a-beginner-guide-40b6) — SIGINT/SIGTERM handling; process.on pattern
- [UUIDs in Node.js (blog.logrocket.com)](https://blog.logrocket.com/uuids-node-js/) — UUID v4 generation options; crypto.randomUUID() vs uuid npm package

### Tertiary (LOW confidence)

- WebSearch results on xterm.js history persistence — mostly GitHub issues from 2017-2021; no current guidance on saving/loading terminal state

---

## Metadata

**Confidence breakdown:**
- Session ID generation (UUID v4): HIGH — crypto.randomUUID() is built-in standard since Node 14.17.0
- SessionManager class pattern: MEDIUM-HIGH — based on proven Socket.IO + node-pty multi-user examples; custom for raw ws, but pattern is established
- WebSocket reconnection handshake: MEDIUM — no standard for this architecture; custom but straightforward
- History buffer circular pattern: HIGH — standard practice in terminal emulators
- Graceful shutdown: HIGH — SIGINT/SIGTERM handling is well-documented

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (30 days — session management patterns are stable; WebSocket library versions may update)

**Key validation needed:** The SessionManager class and WebSocket handshake protocol are custom for this project (Phase 1 used raw ws, not Socket.IO). Implementation should be hands-on tested in Wave 1 to verify the reconnection flow works end-to-end.

---

