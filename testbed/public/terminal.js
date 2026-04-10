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

// Retrieve session ID from URL path — URL is the sole source of truth.
// Never fall back to localStorage, which can point to a different session and cause cross-talk.
const pathMatch = window.location.pathname.match(/\/session\/(.+)/);
const storedSessionId = pathMatch ? pathMatch[1] : null;

// ─── Reconnecting WebSocket ─────────────────────────────────────────
// On unexpected close, reconnect with exponential backoff (1s → 2s → 4s, cap 8s).
// Server replays full terminal history on handshake, so the view self-heals.
let ws = null;
let serverShuttingDown = false;
let sessionEnded = false;
let reconnecting = false;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 8000;

// Exposed state for session-ui.js
window.wingmanTerminal = { sessionId: storedSessionId, ws, term, fitAddon };

function connectWebSocket() {
  ws = new WebSocket("ws://" + location.host);
  window.wingmanTerminal.ws = ws;

  ws.onopen = () => {
    reconnectDelay = 1000;
    reconnecting = false;
    fitAddon.fit();
    ws.send(JSON.stringify({ type: "handshake", sessionId: storedSessionId }));
    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "handshake-ack") {
      window.wingmanTerminal.sessionId = msg.sessionId;

      // Update header
      const desc = msg.description || "Claude Code session";
      document.title = "Wingman - " + desc;

      const headerName = document.getElementById("headerSessionName");
      if (headerName) headerName.textContent = desc;

      const termSessionId = document.getElementById("terminalSessionId");
      if (termSessionId) termSessionId.textContent = "Session: " + msg.sessionId.substring(0, 8);

      const termStatus = document.getElementById("terminalStatus");
      if (termStatus)
        termStatus.textContent =
          msg.status === "resumed" ? "reconnected" : "connected";

      // YOLO / Auto Mode banner
      const yoloBanner = document.getElementById("yolo-banner");
      if (yoloBanner) {
        if (msg.yolo) {
          yoloBanner.textContent = "YOLO MODE — Claude will execute without confirmation";
          yoloBanner.className = "yolo-banner";
          yoloBanner.classList.remove("hidden");
        } else if (msg.autoMode) {
          yoloBanner.textContent = "AUTO MODE";
          yoloBanner.className = "yolo-banner auto-mode";
          yoloBanner.classList.remove("hidden");
        } else {
          yoloBanner.classList.add("hidden");
        }
      }

      // Project name in footer
      if (msg.projectName) {
        const statusProject = document.getElementById("statusProject");
        if (statusProject) statusProject.dataset.projectName = msg.projectName;
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
        // Full reset before replaying — clears viewport, scrollback, and all terminal state
        // (cursor position, scroll regions, character attributes) to prevent corruption
        term.reset();
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
      sessionEnded = true;
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

  ws.onclose = () => {
    if (serverShuttingDown) {
      term.writeln("\r\n\x1b[38;5;208m[Wingman ended]\x1b[0m");
      window.dispatchEvent(new CustomEvent("wingman-connection-lost"));
      return;
    }
    if (sessionEnded) {
      // Session was explicitly stopped — no reconnect needed
      window.dispatchEvent(new CustomEvent("wingman-connection-lost"));
      return;
    }
    // Unexpected disconnect — try to reconnect
    if (!reconnecting) {
      reconnecting = true;
      term.writeln("\r\n\x1b[38;5;208m[Connection lost — reconnecting...]\x1b[0m");
    }
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      connectWebSocket();
    }, reconnectDelay);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
}

connectWebSocket();

// Clear line button — sends Ctrl+U to PTY
document.getElementById("clearLineBtn").addEventListener("click", () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "input", data: "\x15" }));
  }
  term.focus();
});

// Terminal input -> server
term.onData((data) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "input", data }));
  }
});

// Ctrl+C: copy selected text to clipboard; pass through as SIGINT when nothing selected
term.attachCustomKeyEventHandler((e) => {
  if (e.ctrlKey && e.key === "c" && e.type === "keydown") {
    const selection = term.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection).catch(() => {});
      term.clearSelection();
      return false; // prevent sending to PTY
    }
  }
  return true; // pass through
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
