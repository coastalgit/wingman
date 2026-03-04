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
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Initialize SessionManager (singleton) on server startup
const sessionManager = new SessionManager(process.cwd());

wss.on('connection', (ws) => {
  let sessionId = null;
  let dataHandler = null;

  // Browser sends handshake or input message
  ws.on('message', (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      // Handshake: client indicates session ID (null for new, or UUID for reconnect)
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
          // New session: spawn PTY, register with SessionManager
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
            // useConpty: false,  // uncomment if output appears garbled on your system
          });

          sessionManager.spawnSession(ptyProcess);
          sessionId = newSessionId;

          console.log(`Client connected, new session ${newSessionId}`);
          ws.send(JSON.stringify({
            type: 'handshake-ack',
            sessionId: newSessionId,
            status: 'new',
            createdAt: new Date().toISOString(),
            history: [],
          }));

          // Attach PTY listener to this WebSocket connection
          dataHandler = ptyProcess.onData((data) => {
            sessionManager.addToHistory(newSessionId, data);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data }));
            }
          });

          // Notify all clients when this PTY exits
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
  console.log('\nShutting down...');

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
});
