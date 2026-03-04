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

const PORT = process.env.PORT || 7891;

// Git Bash path detection — override with WINGMAN_BASH_PATH env var if needed
const BASH_PATH = process.env.WINGMAN_BASH_PATH
  || 'C:\\Program Files\\Git\\bin\\bash.exe';

if (!require('fs').existsSync(BASH_PATH)) {
  console.error(`Git Bash not found at: ${BASH_PATH}`);
  console.error('Fix: set WINGMAN_BASH_PATH env var to your Git Bash path.');
  process.exit(1);
}

// Spawn Claude Code inside Git Bash via node-pty
// Spike result: clean ConPTY output, useConpty:false not needed
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

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Notify all connected browsers when Claude Code exits
ptyProcess.onExit(({ exitCode, signal }) => {
  console.log(`Claude Code exited (code=${exitCode}, signal=${signal})`);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify({ type: 'session-ended' }));
    }
  });
});

wss.on('connection', (ws) => {
  console.log('Client connected');

  // PTY output -> browser terminal
  const dataHandler = ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  // Browser input/resize -> PTY
  ws.on('message', (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());
      if (msg.type === 'input') ptyProcess.write(msg.data);
      else if (msg.type === 'resize') ptyProcess.resize(msg.cols, msg.rows);
    } catch (e) {
      console.error('Bad message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    dataHandler.dispose();
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
  ptyProcess.kill();
  server.close(() => process.exit(0));
});
