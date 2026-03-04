# Phase 3: Mission Control - Research

**Researched:** 2026-03-04
**Domain:** Node.js multi-page web app, process lifecycle management, PID locking, graceful shutdown
**Confidence:** HIGH

## Summary

Phase 3 transforms the existing single-session terminal app into a multi-session launcher ("Mission Control"). The server currently serves one HTML page (`index.html` with xterm.js) and spawns Claude PTY on WebSocket handshake. Mission Control requires a second page type: a dashboard that lists sessions and provides launch/close/exit controls. Sessions continue to open in separate browser windows, each running the existing terminal UI.

The technical challenges are: (1) serving two distinct page types from Express (dashboard vs. terminal), (2) PID-based single-instance enforcement on Windows, (3) reliable child process cleanup on Windows/ConPTY, (4) manual mode that writes files instead of spawning PTYs, and (5) real-time session status updates via WebSocket broadcast.

**Primary recommendation:** Keep everything in a single Express server. Mission Control is just a second HTML page served at `/` (root), while terminal sessions are served at `/session/:id`. Use a simple hand-rolled PID lock file (write PID to `.ai/wingman/wingman.pid`, check on startup) rather than a library -- the requirements are simple and the project has zero tolerance for unnecessary dependencies.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MC-01 | `npx wingman` opens Mission Control in browser | Express route at `/` serves mission-control.html; `open` package (already in deps) opens it |
| MC-02 | Mission Control displays all active sessions | SessionManager already tracks sessions in-memory; add REST endpoint `GET /api/sessions` + WebSocket broadcast on change |
| MC-03 | New sessions launched from Mission Control | POST `/api/sessions` creates PTY + session; `window.open('/session/:id')` from dashboard JS |
| MC-04 | Session status display (active/closed/reconnectable) | SessionManager already has `closed` flag; add status field derivation (has PTY + not closed = active, closed + has history = reconnectable, etc.) |
| MC-05 | Exit Wingman button | POST `/api/shutdown` triggers same logic as SIGINT handler; broadcast shutdown to all WS clients |
| PROC-01 | Single instance via PID lock | Write `process.pid` to `.ai/wingman/wingman.pid` on startup; check + validate on launch |
| PROC-02 | Duplicate launch prints existing URL | Read PID file, check if process alive (`process.kill(pid, 0)`), print URL if alive |
| PROC-03 | Stale PID cleanup | If PID file exists but process not alive, delete and proceed |
| PROC-04 | Ctrl+C graceful shutdown | Existing SIGINT handler + enhancement: kill all PTYs, close WS, remove PID file |
| PROC-05 | Browser windows notified on shutdown | Broadcast `{ type: 'shutdown' }` to all WS clients before closing server |
| PROC-06 | Zombie prevention | Track all child PIDs; on exit iterate and kill; existing `sessionManager.sessions.forEach` pattern |
| MAN-01 | `--manual` flag starts without Claude | Parse `process.argv` for `--manual`; skip PTY spawn in session creation |
| MAN-02 | Manual mode writes session files | Write `cprompt.md` and `ccontext.md` to `.ai/wingman/` |
| MAN-03 | `/ccc` reads ccontext.md | File written at known path; Claude Code slash command reads it (user configures) |
| MAN-04 | `/ccp` reads cprompt.md | Same as MAN-03 for prompt file |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.21.0 | HTTP server, static files, API routes | Already in use |
| ws | ^8.19.0 | WebSocket for real-time terminal + status updates | Already in use |
| node-pty | ^1.1.0 | PTY spawning for Claude Code | Already in use |
| open | ^10.1.0 | Open browser to Mission Control URL | Already in use |

### No New Dependencies Needed

The entire Phase 3 can be built with Node.js built-in modules + existing dependencies:

- **PID lock file**: `fs.writeFileSync` / `fs.readFileSync` / `fs.unlinkSync` (built-in `fs`)
- **Process alive check**: `process.kill(pid, 0)` (built-in, cross-platform)
- **CLI argument parsing**: `process.argv.includes('--manual')` (no library needed for one flag)
- **Session status broadcast**: Existing `ws` WebSocket server with `wss.clients.forEach`
- **Multi-page routing**: `app.get('/session/:id', ...)` with `res.sendFile` (Express built-in)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled PID lock | proper-lockfile npm | Overkill for single-file PID check; adds dependency for 15 lines of code |
| process.argv parsing | commander/yargs | Overkill for `--manual` flag only |
| tree-kill for cleanup | taskkill via spawned process | node-pty `.kill()` works on Windows with ConPTY; tree-kill only needed if orphan processes appear during testing |

## Architecture Patterns

### Recommended Project Structure Change
```
public/
  mission-control.html   # NEW: Dashboard page (served at /)
  mission-control.js     # NEW: Dashboard client JS
  mission-control.css    # NEW: Dashboard styles
  session.html           # RENAMED from index.html (terminal page, served at /session/:id)
  terminal.js            # EXISTING: xterm.js terminal client (minor URL-based session ID change)
  styles.css             # EXISTING: terminal styles
lib/
  session-manager.js     # EXISTING: Enhanced with status derivation + broadcast hook
  process-lock.js        # NEW: PID lock file management
  manual-mode.js         # NEW: File writer for cprompt.md / ccontext.md
server.js                # EXISTING: Enhanced with routes, API, shutdown, --manual flag
```

### Pattern 1: Two-Page Architecture (Mission Control + Session Terminal)

**What:** Mission Control is served at `/` (the root). Each terminal session is served at `/session/:id`. Both pages share the same WebSocket server but use different message types.

**When to use:** When you have a launcher/dashboard that spawns child views.

**Example:**
```javascript
// server.js routing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mission-control.html'));
});

app.get('/session/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'session.html'));
});

// API endpoints for Mission Control
app.get('/api/sessions', (req, res) => {
  const sessions = sessionManager.getAllSessions();
  res.json(sessions);
});

app.post('/api/sessions', express.json(), (req, res) => {
  const ptyProcess = pty.spawn(BASH_PATH, ['-c', 'claude'], { /*...*/ });
  const sessionId = sessionManager.spawnSession(ptyProcess, {
    description: req.body.description
  });
  res.json({ sessionId, url: `/session/${sessionId}` });
});

app.post('/api/shutdown', (req, res) => {
  res.json({ status: 'shutting-down' });
  gracefulShutdown();
});
```

### Pattern 2: WebSocket Message Routing by Client Type

**What:** Mission Control and session terminals both connect to the same WebSocket server. They identify themselves via handshake type, and receive different message types.

**Example:**
```javascript
// Mission Control client sends:  { type: 'mc-connect' }
// Session terminal client sends: { type: 'handshake', sessionId: '...' }

// Server tags WebSocket connections:
ws.clientType = 'mc';  // or 'session'

// Server broadcasts to MC clients only:
// { type: 'session-update', sessions: [...] }
// { type: 'shutdown' }

// Server sends to session clients only:
// { type: 'handshake-ack', ... }
// { type: 'output', data: '...' }
// { type: 'session-ended', ... }
```

### Pattern 3: PID Lock File

**What:** Write `process.pid` to `.ai/wingman/wingman.pid` on startup. On launch, check if file exists, read PID, check if process alive.

**Example:**
```javascript
// lib/process-lock.js
const fs = require('fs');

function acquireLock(lockPath, port) {
  if (fs.existsSync(lockPath)) {
    const existing = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    try {
      process.kill(existing.pid, 0); // throws if process not alive
      console.log(`Wingman already running at http://localhost:${existing.port}`);
      process.exit(0);
    } catch (e) {
      // Stale lock -- process dead, clean up
      fs.unlinkSync(lockPath);
    }
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, port }));
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch (e) { /* already gone */ }
}

module.exports = { acquireLock, releaseLock };
```

### Pattern 4: Session Status Derivation

**What:** Derive session status from in-memory state rather than storing it as a separate field.

**Example:**
```javascript
getSessionStatus(sessionId) {
  const session = this.sessions.get(sessionId);
  if (!session) return null;
  if (!session.closed && session.ptyProcess) return 'active';
  if (session.closed && session.history.length > 0) return 'reconnectable';
  return 'closed';
}

getAllSessionsWithStatus() {
  return Array.from(this.sessions.values()).map(s => ({
    id: s.id,
    description: s.description || 'Session ' + s.id.substring(0, 8),
    createdAt: s.createdAt,
    status: this.getSessionStatus(s.id),
  }));
}
```

### Anti-Patterns to Avoid
- **Spawning PTY on WebSocket connect for Mission Control**: MC clients should NOT trigger PTY spawn. Only explicit "create session" API calls should spawn PTYs.
- **Storing PTY reference in JSON**: PTY processes are in-memory only. Never serialize them.
- **Using localStorage for session ID in Mission Control**: MC does not own a session. Only session terminal pages use localStorage for reconnect.
- **Multiple Express servers**: Do not create separate HTTP servers for MC and sessions. One server, multiple routes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal rendering | Custom terminal emulator | xterm.js (already in use) | ANSI parsing is extremely complex |
| PTY spawning | Manual process spawning with pipes | node-pty (already in use) | ConPTY integration on Windows is non-trivial |
| Browser opening | Platform-specific commands | `open` package (already in use) | Cross-platform edge cases |

**Key insight:** Phase 3 is primarily about orchestration and routing, not new complex primitives. The hard problems (PTY, terminal rendering, WebSocket) are already solved in Phases 1-2. The PID lock and manual mode are simple enough to hand-roll.

## Common Pitfalls

### Pitfall 1: WebSocket Broadcast Leaking Terminal Data to Mission Control
**What goes wrong:** If you broadcast all messages to all WebSocket clients, Mission Control receives raw terminal output from all sessions.
**Why it happens:** Current code uses `wss.clients.forEach` without filtering by client type.
**How to avoid:** Tag each WebSocket connection with its type (`mc` or `session`) on handshake. Only send terminal output to the session's own WebSocket; send status updates to MC clients.
**Warning signs:** Mission Control page receiving `{ type: 'output' }` messages.

### Pitfall 2: Race Condition on Session Spawn
**What goes wrong:** User clicks "New Session" twice quickly, gets two PTY processes.
**Why it happens:** No debounce or in-progress state on the API endpoint.
**How to avoid:** Disable the button after click until response received. Server-side: each session IS intended to be unique, so this is mainly a UX issue.

### Pitfall 3: PID Lock Not Cleaned on Crash
**What goes wrong:** Server crashes (OOM, unhandled exception), PID file remains, next launch thinks server is running.
**Why it happens:** Only SIGINT handler cleans up; crashes skip cleanup.
**How to avoid:** The stale detection (`process.kill(pid, 0)`) handles this automatically. If PID file exists but process is dead, clean it up and proceed.

### Pitfall 4: Windows SIGINT Behavior
**What goes wrong:** On Windows, SIGINT handling differs from Unix.
**Why it happens:** Windows has no POSIX signals; Node.js emulates SIGINT for Ctrl+C but behavior with child processes differs.
**How to avoid:** Use both `process.on('SIGINT')` and `process.on('exit')` for cleanup. The existing SIGINT handler in server.js works because Node.js on Windows does emit SIGINT for Ctrl+C in terminals.
**Warning signs:** PID file not cleaned up after Ctrl+C.

### Pitfall 5: Session URL Routing vs. Static File Serving
**What goes wrong:** Express `express.static` intercepts requests before route handlers.
**Why it happens:** Middleware order matters. If `index.html` exists in `public/`, `app.use(express.static(...))` serves it at `/` before your custom route.
**How to avoid:** Rename `index.html` to `session.html` (and serve explicitly via route). Place custom routes BEFORE `express.static` middleware in server.js.

### Pitfall 6: node-pty .kill() on Windows
**What goes wrong:** Calling `.kill()` on a node-pty process on Windows may not terminate the child process tree.
**Why it happens:** ConPTY process cleanup on Windows has had historical issues.
**How to avoid:** node-pty 1.1.0 with ConPTY has improved this. If orphan `claude.exe` processes appear during testing, consider using `tree-kill` package as a fallback. Test this explicitly during Phase 3 development.
**Warning signs:** `claude.exe` processes remaining after Wingman shutdown (check Task Manager).

## Code Examples

### Mission Control HTML Structure
```html
<!-- public/mission-control.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Wingman - Mission Control</title>
  <link rel="stylesheet" href="mission-control.css" />
</head>
<body>
  <header>
    <h1>Wingman Mission Control</h1>
    <div class="controls">
      <button id="new-session-btn">New Session</button>
      <button id="exit-btn" class="danger">Exit Wingman</button>
    </div>
  </header>
  <main>
    <div id="sessions-list"></div>
  </main>
  <script src="mission-control.js"></script>
</body>
</html>
```

### Mission Control Client JS Pattern
```javascript
// public/mission-control.js
const ws = new WebSocket('ws://' + location.host);

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'mc-connect' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'session-update') renderSessions(msg.sessions);
  if (msg.type === 'shutdown') showShutdownState();
};

document.getElementById('new-session-btn').addEventListener('click', async () => {
  const btn = document.getElementById('new-session-btn');
  btn.disabled = true;
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Claude Code session' })
    });
    const { sessionId } = await res.json();
    window.open('/session/' + sessionId, '_blank');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('exit-btn').addEventListener('click', async () => {
  await fetch('/api/shutdown', { method: 'POST' });
});

function renderSessions(sessions) {
  const container = document.getElementById('sessions-list');
  // Use DOM methods to build session cards safely
  container.replaceChildren();
  sessions.forEach(s => {
    const card = document.createElement('div');
    card.className = 'session-card ' + s.status;

    const desc = document.createElement('span');
    desc.className = 'session-desc';
    desc.textContent = s.description || 'Session ' + s.id.substring(0, 8);
    card.appendChild(desc);

    const status = document.createElement('span');
    status.className = 'session-status';
    status.textContent = s.status;
    card.appendChild(status);

    if (s.status === 'active') {
      const openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => window.open('/session/' + s.id));
      card.appendChild(openBtn);

      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', () => closeSession(s.id));
      card.appendChild(closeBtn);
    }

    container.appendChild(card);
  });
}

async function closeSession(sessionId) {
  await fetch('/api/sessions/' + sessionId, { method: 'DELETE' });
}
```

### Server-Side Session Broadcast
```javascript
// Broadcast session status update to all Mission Control clients
function broadcastSessionUpdate() {
  const sessions = sessionManager.getAllSessionsWithStatus();
  const msg = JSON.stringify({ type: 'session-update', sessions });
  wss.clients.forEach(client => {
    if (client.readyState === 1 && client.clientType === 'mc') {
      client.send(msg);
    }
  });
}
```

### Graceful Shutdown Function
```javascript
function gracefulShutdown() {
  // 1. Broadcast shutdown to all browser clients
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'shutdown' }));
    }
  });

  // 2. Kill all active PTY processes
  sessionManager.sessions.forEach((session, sessionId) => {
    if (session.ptyProcess && !session.closed) {
      session.ptyProcess.kill();
      sessionManager.closeSession(sessionId);
    }
  });

  // 3. Close WebSocket connections
  wss.clients.forEach(client => client.terminate());

  // 4. Remove PID lock file
  releaseLock(lockPath);

  // 5. Close HTTP server
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
```

### Session Terminal URL-Based Session ID
```javascript
// terminal.js modification: read session ID from URL path instead of localStorage only
const pathMatch = window.location.pathname.match(/\/session\/(.+)/);
const urlSessionId = pathMatch ? pathMatch[1] : null;
const storedSessionId = urlSessionId || localStorage.getItem('wingmanSessionId') || null;
```

### Manual Mode File Writing
```javascript
// lib/manual-mode.js
const fs = require('fs');
const path = require('path');

function initManualMode(wingmanDir) {
  const promptPath = path.join(wingmanDir, 'cprompt.md');
  const contextPath = path.join(wingmanDir, 'ccontext.md');

  if (!fs.existsSync(promptPath)) {
    fs.writeFileSync(promptPath, '# Prompt\n\nWrite your prompt here.\n');
  }
  if (!fs.existsSync(contextPath)) {
    fs.writeFileSync(contextPath, '# Context\n\nWrite your context here.\n');
  }

  return { promptPath, contextPath };
}

module.exports = { initManualMode };
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| index.html at root = terminal | Mission Control at root, terminals at /session/:id | Phase 3 | Root URL changes from terminal to dashboard |
| PTY spawns on WS connect | PTY spawns on explicit API call from MC | Phase 3 | Separates session creation from WS connection |
| Single SIGINT handler | SIGINT + exit + PID file cleanup | Phase 3 | More robust shutdown |
| No CLI flags | `--manual` flag via process.argv | Phase 3 | Enables file-only mode |

## Open Questions

1. **Session Description Input**
   - What we know: User wants description string shown in UI (not raw UUID)
   - What is unclear: Should there be a text input in Mission Control before launching, or auto-generated descriptions like "Session 1", "Session 2"?
   - Recommendation: Simple auto-incrementing ("Session 1", "Session 2") with optional rename, or a small input prompt on "New Session" click. Planner should decide.

2. **Manual Mode UI**
   - What we know: MAN-01 through MAN-04 describe file-based prompt/context management
   - What is unclear: Does manual mode have ANY UI, or is it purely CLI + file system?
   - Recommendation: Manual mode should still open Mission Control in the browser, but with a "Manual Mode" indicator and no "New Session" button. Instead show the file paths for `cprompt.md` and `ccontext.md`. This gives the user a home screen while they use slash commands in their own terminal.

3. **tree-kill Necessity**
   - What we know: node-pty `.kill()` has had Windows issues historically; ConPTY improved things in v1.1.0
   - What is unclear: Whether `.kill()` reliably terminates `claude.exe` + its children on this system
   - Recommendation: Test with `.kill()` first. Only add `tree-kill` dependency if orphan processes appear during testing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual UAT (no automated test framework in project) |
| Config file | none |
| Quick run command | `node server.js` then manual browser testing |
| Full suite command | Manual verification checklist |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MC-01 | npx wingman opens Mission Control | manual | Start server, verify browser opens to dashboard | N/A |
| MC-02 | Dashboard shows active sessions | manual | Launch session, verify it appears in list | N/A |
| MC-03 | Launch session from MC | manual | Click New Session, verify new window opens with terminal | N/A |
| MC-04 | Session status display | manual | Create/close sessions, verify status changes | N/A |
| MC-05 | Exit Wingman button | manual | Click Exit, verify all sessions close + server stops | N/A |
| PROC-01 | PID lock prevents duplicates | manual | Run server twice, verify second prints URL | N/A |
| PROC-02 | Duplicate prints URL | manual | Same as PROC-01 | N/A |
| PROC-03 | Stale lock cleanup | manual | Kill server process, restart, verify clean start | N/A |
| PROC-04 | Ctrl+C cleanup | manual | Ctrl+C server, verify PID file removed + PTYs dead | N/A |
| PROC-05 | Browser notification on shutdown | manual | Ctrl+C, verify browser shows shutdown message | N/A |
| PROC-06 | No zombie processes | manual | After shutdown, check task manager for orphan claude.exe | N/A |
| MAN-01 | --manual flag | manual | `node server.js --manual`, verify no Claude spawns | N/A |
| MAN-02 | Manual mode writes files | manual | Start --manual, verify cprompt.md and ccontext.md exist | N/A |
| MAN-03 | /ccc reads context file | manual-only | Requires active Claude Code session with slash command | N/A |
| MAN-04 | /ccp reads prompt file | manual-only | Same as MAN-03 | N/A |

### Sampling Rate
- **Per task commit:** `node server.js` + manual browser check
- **Per wave merge:** Full requirement checklist walkthrough
- **Phase gate:** All 15 requirements verified manually

### Wave 0 Gaps
None -- this project uses manual UAT, not automated testing. No test infrastructure needed.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `server.js`, `lib/session-manager.js`, `public/terminal.js`, `public/index.html` -- direct code analysis
- [Express routing docs](https://expressjs.com/en/guide/routing.html) -- multi-page pattern
- [node-pty API docs](https://www.jsdocs.io/package/node-pty) -- kill method, ConPTY behavior

### Secondary (MEDIUM confidence)
- [Node.js child_process docs](https://nodejs.org/api/child_process.html) -- process.kill signal behavior on Windows
- [proper-lockfile npm](https://www.npmjs.com/package/proper-lockfile) -- reviewed but NOT recommended (overkill)
- [tree-kill npm](https://github.com/pkrumins/node-tree-kill) -- potential fallback for Windows process cleanup

### Tertiary (LOW confidence)
- [node-pty Windows kill issues](https://github.com/microsoft/node-pty/issues/437) -- historical, may be resolved in v1.1.0

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed, all existing libraries sufficient
- Architecture: HIGH -- two-page Express app with shared WebSocket is well-understood pattern
- Pitfalls: MEDIUM -- Windows-specific process cleanup behavior needs hands-on validation
- Manual mode: HIGH -- simple file writing, straightforward requirements

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain, no fast-moving dependencies)
