// server.js
// node-pty: using node-pty (native build succeeded on Node 20 / Windows)
//
// ConPTY spike result (01-02 Task 1):
//   Git Bash spawns cleanly via node-pty + ConPTY. Output is clean (no garbled binary).
//   useConpty: false is NOT needed.
//
// Claude binary:
//   Native installer binary at ~/.local/bin/claude.exe (v2.1.68).
//   The native binary works correctly with node-pty + ConPTY on this system.
//   No npm version present; native binary is used directly via `bash -c 'claude'`.

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const pty = require('node-pty');
const SessionManager = require('./lib/session-manager.js');
const { acquireLock, releaseLock } = require('./lib/process-lock.js');
const { initManualMode } = require('./lib/manual-mode.js');

const PORT = process.env.PORT || 7891;
const lockPath = path.join(process.cwd(), '.ai', 'wingman', 'wingman.pid');
const MANUAL_MODE = process.argv.includes('--manual');

// Git Bash path detection — override with WINGMAN_BASH_PATH env var if needed
const BASH_PATH = process.env.WINGMAN_BASH_PATH
  || 'C:\\Program Files\\Git\\bin\\bash.exe';

if (!require('fs').existsSync(BASH_PATH)) {
  console.error(`Git Bash not found at: ${BASH_PATH}`);
  console.error('Fix: set WINGMAN_BASH_PATH env var to your Git Bash path.');
  process.exit(1);
}

const app = express();

// JSON body parsing for POST endpoints
app.use(express.json());

// --- Custom routes (BEFORE express.static to avoid index.html interception) ---

// Mission Control dashboard at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mission-control.html'));
});

// Session terminal page (UUID pattern only — prevents catching static file requests)
app.get('/session/:id([0-9a-f-]{36})', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'session.html'));
});

// REST API: Server mode (normal vs manual)
app.get('/api/mode', (req, res) => {
  res.json({ manual: MANUAL_MODE });
});

// REST API: List all sessions with status
app.get('/api/sessions', (req, res) => {
  res.json(sessionManager.getAllSessionsWithStatus());
});

// REST API: Create a new session (spawns PTY)
app.post('/api/sessions', (req, res) => {
  if (MANUAL_MODE) {
    return res.status(400).json({ error: 'Manual mode active — no Claude sessions spawned', manual: true });
  }

  const description = (req.body && req.body.description) || 'Claude Code session';

  // Register session metadata first (with no PTY yet), then spawn
  const sessionId = sessionManager.spawnSession(null, { description });
  spawnAndWirePty(sessionId);
  broadcastSessionUpdate();

  res.json({ sessionId, url: '/session/' + sessionId });
});

// REST API: Close/delete a session
app.delete('/api/sessions/:id', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Kill PTY if still active
  if (session.ptyProcess && !session.closed) {
    session.ptyProcess.kill();
  }
  sessionManager.closeSession(req.params.id);
  broadcastSessionUpdate();

  res.json({ status: 'closed', sessionId: req.params.id });
});

// REST API: Shutdown Wingman
app.post('/api/shutdown', (req, res) => {
  res.json({ status: 'shutting-down' });
  gracefulShutdown();
});

// Static files AFTER custom routes (avoids index.html interception)
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Acquire PID lock — blocks duplicate launches (prints existing URL and exits if alive)
acquireLock(lockPath, PORT);

// Initialize SessionManager (singleton) on server startup
const sessionManager = new SessionManager(process.cwd());

// Manual mode: create prompt/context files, skip PTY spawning
if (MANUAL_MODE) {
  const { promptPath, contextPath } = initManualMode(sessionManager.sessionsDir);
  console.log('Wingman started in manual mode. Session files:');
  console.log('  Prompt:  ' + promptPath);
  console.log('  Context: ' + contextPath);
}

// Broadcast session list update to all Mission Control clients
function broadcastSessionUpdate() {
  const sessions = sessionManager.getAllSessionsWithStatus();
  const msg = JSON.stringify({ type: 'session-update', sessions });
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.clientType === 'mc') {
      client.send(msg);
    }
  });
}

// Spawn a PTY and wire up onData/onExit for a session that already exists in SessionManager.
// Used both for new sessions (POST /api/sessions) and reconnecting to reconnectable sessions.
function spawnAndWirePty(sessionId) {
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

  // Wire the new PTY into the existing session object
  const session = sessionManager.getSession(sessionId);
  session.ptyProcess = ptyProcess;
  session.closed = false;
  session.primaryWs = null; // reset primary on new PTY
  sessionManager.updateSessionsFile();

  // Buffer PTY output into history and broadcast to all connected terminal clients
  ptyProcess.onData((data) => {
    sessionManager.addToHistory(sessionId, data);
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.sessionId === sessionId) {
        client.send(JSON.stringify({ type: 'output', data }));
      }
    });
  });

  // PTY exited naturally (e.g. user typed 'exit') — detach but keep session reconnectable
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Session ${sessionId}: PTY exited (code=${exitCode}, signal=${signal})`);
    sessionManager.detachPty(sessionId);
    broadcastSessionUpdate();
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.sessionId === sessionId) {
        client.send(JSON.stringify({ type: 'session-ended', sessionId }));
      }
    });
  });

  return ptyProcess;
}

// Graceful shutdown: broadcast, kill PTYs (leave sessions reconnectable), release lock, close server
let shuttingDown = false;
function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nShutting down...');

  // Broadcast shutdown to all WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'shutdown' }));
    }
  });

  // Kill active PTY processes — use detachPty so sessions remain reconnectable on next start
  sessionManager.sessions.forEach((session, sessionId) => {
    if (session.ptyProcess) {
      session.ptyProcess.kill();
      sessionManager.detachPty(sessionId);
    }
  });

  // Release PID lock
  releaseLock(lockPath);

  // Close WebSocket connections before shutting down HTTP server
  wss.clients.forEach((ws) => ws.terminate());
  server.close(() => process.exit(0));
  // Force exit if server.close() stalls (e.g. open connections)
  setTimeout(() => process.exit(0), 500).unref();
}

wss.on('connection', (ws) => {
  let sessionId = null;

  ws.on('message', (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      // Mission Control client identification
      if (msg.type === 'mc-connect') {
        ws.clientType = 'mc';
        ws.send(JSON.stringify({
          type: 'session-update',
          sessions: sessionManager.getAllSessionsWithStatus(),
        }));
        return;
      }

      // Handshake: client connects to an existing session
      if (msg.type === 'handshake') {
        sessionId = msg.sessionId || null;

        if (sessionId && sessionManager.getSession(sessionId)) {
          const session = sessionManager.getSession(sessionId);

          // If reconnectable (PTY dead, not explicitly closed), spawn a fresh Claude process
          if (!session.ptyProcess && !session.closed) {
            console.log(`Session ${sessionId}: reconnecting — spawning new PTY`);
            spawnAndWirePty(sessionId);
            broadcastSessionUpdate();
          }

          // Tag this WebSocket for PTY output broadcasting
          ws.sessionId = sessionId;

          // First client to connect to this session controls PTY resize
          if (!session.primaryWs) {
            session.primaryWs = ws;
            ws.isPrimary = true;
          }

          // Active sessions: don't replay history — raw PTY output (TUI escape sequences,
          // cursor moves, screen clears) renders as garbage in a fresh terminal context.
          // Secondary viewers just join the live stream from this point forward.
          // Reconnectable sessions (PTY dead): replay history so user has context.
          const isActive = !!(session.ptyProcess && !session.closed);
          const history = isActive ? [] : sessionManager.getHistory(sessionId);
          const status = isActive && !ws.isPrimary ? 'joined' : (history.length > 0 ? 'resumed' : 'new');

          console.log(`Client connected to session ${sessionId} (status: ${status}, primary: ${ws.isPrimary || false})`);
          ws.send(JSON.stringify({
            type: 'handshake-ack',
            sessionId,
            status,
            description: session.description || 'Claude Code session',
            createdAt: session.createdAt,
            history,
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown session. Launch from Mission Control.',
          }));
        }
      }

      // Input: route to active session's PTY
      if (msg.type === 'input') {
        const session = sessionManager.getSession(sessionId);
        if (session && session.ptyProcess) {
          session.ptyProcess.write(msg.data);
        }
      }

      // Resize: only the primary client controls PTY dimensions
      // This prevents multiple tabs from fighting over the terminal size
      if (msg.type === 'resize' && ws.isPrimary) {
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
    // If primary client disconnected, clear so next connection can take over
    if (ws.isPrimary && sessionId) {
      const session = sessionManager.getSession(sessionId);
      if (session && session.primaryWs === ws) {
        session.primaryWs = null;
      }
    }
    console.log('Client disconnected');
  });

  ws.on('error', (err) => console.error('WebSocket error:', err));
});

server.listen(PORT, () => {
  const modeLabel = MANUAL_MODE ? 'Wingman (manual mode)' : 'Wingman';
  console.log(`${modeLabel} running at http://localhost:${PORT}`);
  // open v10 is ESM-only; use dynamic import for CJS compatibility
  import('open').then(({ default: open }) => open(`http://localhost:${PORT}`));
});

process.on('SIGINT', () => gracefulShutdown());

// Safety net: release lock on any exit (sync-only, no async work)
process.on('exit', () => releaseLock(lockPath));

// Prevent PID file from persisting on uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown();
});
