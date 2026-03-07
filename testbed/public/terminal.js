// terminal.js
// CDN globals: Terminal, FitAddon.FitAddon, WebLinksAddon.WebLinksAddon
// Exposes: window.wingmanTerminal = { sessionId, ws, term, fitAddon }

const term = new Terminal({
  cursorBlink: true,
  scrollback: 10000,
  theme: {
    background: "#0d1117",
    foreground: "#c9d1d9",
    cursor: "#58a6ff",
  },
  fontFamily: "Cascadia Code, Fira Code, Consolas, monospace",
  fontSize: 14,
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);
term.loadAddon(new WebLinksAddon.WebLinksAddon());

term.open(document.getElementById("terminal"));
requestAnimationFrame(() => fitAddon.fit());

// WebSocket connection to server
const ws = new WebSocket("ws://" + location.host);
let serverShuttingDown = false;

// Retrieve session ID from URL path
const pathMatch = window.location.pathname.match(/\/session\/(.+)/);
const urlSessionId = pathMatch ? pathMatch[1] : null;
const storedSessionId =
  urlSessionId || localStorage.getItem("wingmanSessionId") || null;

// Exposed state for session-ui.js
window.wingmanTerminal = { sessionId: storedSessionId, ws, term, fitAddon };

// Server output -> terminal
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "handshake-ack") {
    localStorage.setItem("wingmanSessionId", msg.sessionId);
    window.wingmanTerminal.sessionId = msg.sessionId;

    // Update header
    const desc = msg.description || "Claude Code session";
    document.title = "Wingman - " + desc;

    const headerName = document.getElementById("headerSessionName");
    if (headerName) headerName.textContent = desc;

    const termStatus = document.getElementById("terminalStatus");
    if (termStatus)
      termStatus.textContent =
        msg.status === "resumed" ? "reconnected" : "connected";

    // YOLO banner
    const yoloBanner = document.getElementById("yolo-banner");
    if (yoloBanner) {
      if (msg.yolo) {
        yoloBanner.textContent = "YOLO MODE — Claude will execute without confirmation";
        yoloBanner.classList.remove("hidden");
      } else {
        yoloBanner.classList.add("hidden");
      }
    }

    // Chrome indicator
    const chromeIndicator = document.getElementById("chrome-indicator");
    if (chromeIndicator) {
      chromeIndicator.classList.toggle("hidden", !msg.withChrome);
    }

    // Replay history, then fire ready only after xterm has finished rendering
    const fireReady = () => {
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent("wingman-session-ready", {
            detail: { sessionId: msg.sessionId, description: desc },
          }),
        );
      });
    };

    if (msg.history && msg.history.length > 0) {
      let remaining = msg.history.length;
      msg.history.forEach((chunk) => {
        term.write(chunk, () => {
          remaining--;
          if (remaining === 0) fireReady();
        });
      });
    } else {
      fireReady();
    }

    console.log(
      "Connected to session " + msg.sessionId + " (status: " + msg.status + ")",
    );
    return;
  }

  if (msg.type === "output") {
    term.write(msg.data);
  } else if (msg.type === "session-ended") {
    term.writeln("\r\n\x1b[33m[Session ended]\x1b[0m");
    const termStatus = document.getElementById("terminalStatus");
    if (termStatus) termStatus.textContent = "stopped";
    window.dispatchEvent(new CustomEvent("wingman-session-ended"));
  } else if (msg.type === "shutdown") {
    serverShuttingDown = true;
    term.writeln("\r\n\x1b[38;5;208m[Wingman shutting down...]\x1b[0m");
  } else if (msg.type === "error") {
    term.writeln("\r\n\x1b[38;5;208m[Error: " + msg.message + "]\x1b[0m");
  }
};

// Terminal input -> server
term.onData((data) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "input", data }));
  }
});

// Resize: propagate terminal dimensions to PTY
let resizeTimeout;
const observer = new ResizeObserver(() => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    fitAddon.fit();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }),
      );
    }
  }, 50);
});
observer.observe(document.getElementById("terminal"));

// Send handshake after WebSocket opens
ws.onopen = () => {
  fitAddon.fit();
  ws.send(JSON.stringify({ type: "handshake", sessionId: storedSessionId }));
  ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
};

ws.onclose = () => {
  if (serverShuttingDown) {
    term.writeln("\r\n\x1b[38;5;208m[Wingman ended]\x1b[0m");
  } else {
    term.writeln("\r\n\x1b[38;5;208m[Connection closed]\x1b[0m");
  }
};

ws.onerror = (err) => {
  console.error("WebSocket error:", err);
};
