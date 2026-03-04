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

const PORT = process.env.PORT || 7891;

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

// Session terminal page
app.get('/session/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'session.html'));
});

// REST API: List all sessions with status
app.get('/api/sessions', (req, res) => {
  res.json(sessionManager.getAllSessionsWithStatus());
});

// REST API: Create a new session (spawns PTY)
app.post('/api/sessions', (req, res) => {
  const description = (req.body && req.body.description) || 'Claude Code session';

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

  const sessionId = sessionManager.spawnSession(ptyProcess, { description });

  // Register PTY exit handler
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Session ${sessionId}: PTY exited (code=${exitCode}, signal=${signal})`);
    sessionManager.closeSession(sessionId);
    broadcastSessionUpdate();

    // Notify terminal clients about session end
    wss.clients.forEach((client) => {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        client.send(JSON.stringify({ type: 'session-ended', sessionId }));
      }
    });
  });

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

// Initialize SessionManager (singleton) on server startup
const sessionManager = new SessionManager(process.cwd());

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

// Graceful shutdown: broadcast, kill PTYs, close server
function gracefulShutdown() {
  console.log('\nShutting down...');

  // Broadcast shutdown to all WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'shutdown' }));
    }
  });

  // Kill all active PTY processes and mark sessions closed
  sessionManager.sessions.forEach((session, sessionId) => {
    if (session.ptyProcess && !session.closed) {
      session.ptyProcess.kill();
      sessionManager.closeSession(sessionId);
    }
  });

  // Close WebSocket connections before shutting down HTTP server
  wss.clients.forEach((ws) => ws.terminate());
  server.close(() => process.exit(0));
  // Force exit if server.close() stalls (e.g. open connections)
  setTimeout(() => process.exit(0), 500).unref();
}

wss.on('connection', (ws) => {
  let sessionId = null;
  let dataHandler = null;

  // Browser sends handshake, mc-connect, or input message
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

      // Handshake: client indicates session ID for reconnect
      if (msg.type === 'handshake') {
        sessionId = msg.sessionId || null;

        if (sessionId && sessionManager.getSession(sessionId)) {
          // Reconnect to existing session
          const session = sessionManager.getSession(sessionId);
          const history = sessionManager.getHistory(sessionId);

          console.log(`Client reconnected to session ${sessionId}`);
          ws.send(JSON.stringify({
            type: 'handshake-ack',
            sessionId,
            status: 'resumed',
            description: session.description || 'Claude Code session',
            createdAt: session.createdAt,
            history,
          }));

          // Attach PTY listener to this WebSocket connection
          if (session.ptyProcess && !session.closed) {
            dataHandler = session.ptyProcess.onData((data) => {
              sessionManager.addToHistory(sessionId, data);
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: 'output', data }));
              }
            });
          }
        } else {
          // No null-spawn: sessions are ONLY created via POST /api/sessions
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

      // Resize: route to active session's PTY
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
    console.log('Client disconnected');
    if (dataHandler) dataHandler.dispose();
  });

  ws.on('error', (err) => console.error('WebSocket error:', err));
});

server.listen(PORT, () => {
  console.log(`Wingman running at http://localhost:${PORT}`);
  // open v10 is ESM-only; use dynamic import for CJS compatibility
  import('open').then(({ default: open }) => open(`http://localhost:${PORT}`));
});

process.on('SIGINT', () => {
  gracefulShutdown();
});
