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

// Retrieve session ID from URL path first, then fall back to localStorage
const pathMatch = window.location.pathname.match(/\/session\/(.+)/);
const urlSessionId = pathMatch ? pathMatch[1] : null;
const storedSessionId = urlSessionId || localStorage.getItem('wingmanSessionId') || null;

// Server output -> terminal (write raw data — xterm.js handles all ANSI)
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  // Handle handshake-ack first (should be the first message on any connect/reconnect)
  if (msg.type === 'handshake-ack') {
    // Persist session ID in localStorage for future reconnects
    localStorage.setItem('wingmanSessionId', msg.sessionId);

    // Display session info — show description, not raw UUID
    const desc = msg.description || 'Claude Code session';
    document.title = `Wingman - ${desc}`;

    const sessionDescSpan = document.getElementById('session-description');
    const sessionCreatedSpan = document.getElementById('session-created');
    if (sessionDescSpan) {
      sessionDescSpan.textContent = desc;
    }
    if (sessionCreatedSpan) {
      const created = new Date(msg.createdAt).toLocaleString();
      sessionCreatedSpan.textContent = created;
    }

    // Replay history if reconnecting (status: "resumed" or if history array is non-empty)
    if (msg.history && msg.history.length > 0) {
      term.writeln('[Replaying session history...]');
      msg.history.forEach(line => term.write(line));
      term.writeln('[End of history]');
    }

    console.log(`Connected to session ${msg.sessionId} (status: ${msg.status})`);
    return;  // Don't process other message types in handshake-ack
  }

  // Handle output (existing behavior, unchanged)
  if (msg.type === 'output') {
    term.write(msg.data);
  } else if (msg.type === 'session-ended') {
    term.writeln('\r\n\x1b[33m[Session ended]\x1b[0m');
  } else if (msg.type === 'shutdown') {
    term.writeln('\r\n\x1b[31m[Wingman shutting down...]\x1b[0m');
  } else if (msg.type === 'error') {
    term.writeln('\r\n\x1b[31m[Error: ' + msg.message + ']\x1b[0m');
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

// Send handshake after WebSocket opens
ws.onopen = () => {
  fitAddon.fit();

  // Send handshake with session ID (null for new sessions, UUID for reconnects)
  ws.send(JSON.stringify({ type: 'handshake', sessionId: storedSessionId }));

  // Send resize after handshake
  ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
};

ws.onclose = () => {
  term.writeln('\r\n\x1b[31m[Connection closed]\x1b[0m');
};

ws.onerror = (err) => {
  console.error('WebSocket error:', err);
};
