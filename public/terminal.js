// terminal.js
// CDN globals: Terminal, FitAddon.FitAddon, WebLinksAddon.WebLinksAddon

const term = new Terminal({
  cursorBlink: true,
  scrollback: 10000,
  theme: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
  },
  fontFamily: 'Cascadia Code, Fira Code, Consolas, monospace',
  fontSize: 14,
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon.WebLinksAddon());

term.open(document.getElementById('terminal'));
fitAddon.fit();

// WebSocket connection to server
const ws = new WebSocket('ws://' + location.host);

// Server output -> terminal (write raw data — xterm.js handles all ANSI)
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'output') {
    term.write(msg.data);
  } else if (msg.type === 'session-ended') {
    term.writeln('\r\n\x1b[33m[Session ended]\x1b[0m');
  }
};

// Terminal input -> server (DO NOT call term.write here — PTY handles echo)
term.onData((data) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', data }));
  }
});

// Resize: propagate browser terminal dimensions to PTY (debounced 50ms)
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

// Send initial resize after WebSocket opens
ws.onopen = () => {
  fitAddon.fit();
  ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
};

ws.onclose = () => {
  term.writeln('\r\n\x1b[31m[Connection closed]\x1b[0m');
};

ws.onerror = (err) => {
  console.error('WebSocket error:', err);
};
