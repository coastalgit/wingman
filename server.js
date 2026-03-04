// server.js
// node-pty: using node-pty (native build succeeded on Node 20 / Windows)

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 7891;
let ptyProcess = null; // assigned in Plan 02

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (rawMsg) => {
    const msg = JSON.parse(rawMsg.toString());
    if (ptyProcess) {
      if (msg.type === 'input') ptyProcess.write(msg.data);
      else if (msg.type === 'resize') ptyProcess.resize(msg.cols, msg.rows);
    } else {
      ws.send(JSON.stringify({ type: 'output', data: '[Server: PTY not yet attached]\r\n' }));
    }
  });

  ws.on('close', () => console.log('Client disconnected'));
  ws.on('error', (err) => console.error('WebSocket error:', err));
});

server.listen(PORT, () => {
  console.log(`Wingman running at http://localhost:${PORT}`);
  // open v10 is ESM-only; use dynamic import for CJS compatibility
  import('open').then(({ default: open }) => open(`http://localhost:${PORT}`));
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (ptyProcess) ptyProcess.kill();
  server.close(() => process.exit(0));
});

module.exports = { ptyProcess };
