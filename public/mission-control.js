// mission-control.js — Wingman Mission Control dashboard client

const sessionsList = document.getElementById("sessions-list");
const newSessionBtn = document.getElementById("new-session-btn");
const exitBtn = document.getElementById("exit-btn");
const shutdownOverlay = document.getElementById("shutdown-overlay");
const modeBanner = document.getElementById("mode-banner");

let isManualMode = false;

// Fetch version and update status bar
fetch("/api/version")
  .then((r) => r.json())
  .then((data) => {
    if (!data.version) return;
    const parts = data.version.split(".");
    const label = "Wingman v" + parts[0] + "." + parts[1] + " build " + (data.build || 0);
    const el = document.getElementById("statusProject");
    if (el) el.textContent = label;
  })
  .catch(() => {});

// Check server mode and adapt UI accordingly
fetch("/api/mode")
  .then((r) => r.json())
  .then((data) => {
    if (data.manual) {
      isManualMode = true;
      modeBanner.textContent =
        "MANUAL MODE — No Claude sessions spawned. Files at .ai/wingman/cprompt.md and .ai/wingman/ccontext.md";
      modeBanner.style.display = "block";
      newSessionBtn.disabled = true;
    }
  })
  .catch(() => {
    /* non-critical, ignore */
  });

// WebSocket connection to server
const ws = new WebSocket("ws://" + location.host);

ws.onopen = () => {
  // Identify as Mission Control client
  ws.send(JSON.stringify({ type: "mc-connect" }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "session-update") {
    renderSessions(msg.sessions);
    const active = (msg.sessions || []).filter(
      (s) => s.status === "active",
    ).length;
    const el = document.getElementById("statusSessions");
    if (el)
      el.textContent = active + " active session" + (active !== 1 ? "s" : "");
  }

  if (msg.type === "shutdown") {
    shutdownOverlay.classList.remove("hidden");
    newSessionBtn.disabled = true;
    exitBtn.disabled = true;
  }
};

ws.onclose = () => {
  const overlayContent = document.querySelector(".overlay-content");
  if (!shutdownOverlay.classList.contains("hidden")) {
    // Server finished shutting down — update from "shutting down..." to final state
    overlayContent.textContent = "Wingman ended";
  } else {
    // Unexpected connection loss
    shutdownOverlay.classList.remove("hidden");
    overlayContent.textContent = "Connection lost.";
  }
};

ws.onerror = (err) => {
  console.error("WebSocket error:", err);
};

// Polling fallback — catches any missed WS broadcasts (e.g. natural PTY exit)
setInterval(async () => {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) return;
    const sessions = await res.json();
    renderSessions(sessions);
    const active = sessions.filter((s) => s.status === "active").length;
    const el = document.getElementById("statusSessions");
    if (el) el.textContent = active + " active session" + (active !== 1 ? "s" : "");
  } catch { /* non-critical */ }
}, 4000);

// New Session button — prompt for name, open window immediately to avoid popup block
newSessionBtn.addEventListener("click", async () => {
  const description = prompt("Session name:", "Claude Code session");
  if (!description) return; // user cancelled

  // Open blank window now (within user gesture) before the async fetch
  const win = window.open("", "_blank");

  newSessionBtn.disabled = true;
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: description.trim() }),
    });
    const data = await res.json();
    if (data.sessionId && win) {
      win.location.href = "/session/" + data.sessionId;
    } else if (win) {
      win.close();
    }
  } catch (err) {
    console.error("Failed to create session:", err);
    if (win) win.close();
  } finally {
    newSessionBtn.disabled = false;
  }
});

// Exit Wingman button
exitBtn.addEventListener("click", async () => {
  exitBtn.disabled = true;
  newSessionBtn.disabled = true;
  try {
    await fetch("/api/shutdown", { method: "POST" });
  } catch (err) {
    // Server is shutting down, connection errors are expected
  }
});

let selectedSessionId = null;

// Render session cards using DOM methods (no innerHTML for security)
function renderSessions(sessions) {
  sessionsList.replaceChildren();

  if (!sessions || sessions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = isManualMode
      ? "Manual mode active. Edit prompt/context files in .ai/wingman/ and use /ccc, /ccp in your Claude Code session."
      : "No sessions. Click 'New Session' to start.";
    sessionsList.appendChild(empty);
    return;
  }

  // Sort by most recently created first
  sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  sessions.forEach((session) => {
    const isActive = session.status === "active";
    const name = session.description || "Unnamed session";

    // ── Outer wrapper (bin outside card) ──────────────────
    const wrapper = document.createElement("div");
    wrapper.className = "card-wrapper";

    // Delete button — outside card, to its left
    const outerLeft = document.createElement("div");
    outerLeft.className = "card-outer-left";
    if (!isActive) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-icon btn-delete";
      deleteBtn.title = "Delete session";
      deleteBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm('Delete session "' + name + '"?\n\nThis cannot be undone.')) return;
        deleteBtn.disabled = true;
        try {
          await fetch("/api/sessions/" + session.id + "/delete", { method: "DELETE" });
        } catch (err) {
          console.error("Failed to delete session:", err);
          deleteBtn.disabled = false;
        }
      });
      outerLeft.appendChild(deleteBtn);
    }
    wrapper.appendChild(outerLeft);

    const card = document.createElement("div");
    card.className = "session-card " + session.status + (session.id === selectedSessionId ? " selected" : "");
    card.addEventListener("click", () => {
      selectedSessionId = session.id === selectedSessionId ? null : session.id;
      document.querySelectorAll(".session-card").forEach(c => c.classList.remove("selected"));
      if (selectedSessionId) card.classList.add("selected");
    });
    card.addEventListener("dblclick", () => {
      window.open("/session/" + session.id, "_blank");
    });

    // ── Top section ───────────────────────────────────────
    const cardTop = document.createElement("div");
    cardTop.className = "card-top";

    // Session info
    const info = document.createElement("div");
    info.className = "session-info";

    const desc = document.createElement("div");
    desc.className = "session-description";
    desc.textContent = name;
    info.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "session-meta";
    const d = new Date(session.createdAt);
    meta.textContent =
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " · " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    info.appendChild(meta);
    cardTop.appendChild(info);

    // Actions
    const actions = document.createElement("div");
    actions.className = "session-actions";

    const openBtn = document.createElement("button");
    openBtn.className = "btn open";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.open("/session/" + session.id, "_blank");
    });
    actions.appendChild(openBtn);

    if (isActive) {
      const stopBtn = document.createElement("button");
      stopBtn.className = "btn danger";
      stopBtn.textContent = "Stop";
      stopBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        stopBtn.disabled = true;
        try {
          await fetch("/api/sessions/" + session.id, { method: "DELETE" });
        } catch (err) {
          console.error("Failed to stop session:", err);
          stopBtn.disabled = false;
        }
      });
      actions.appendChild(stopBtn);
    }

    cardTop.appendChild(actions);
    card.appendChild(cardTop);

    // ── Separator ─────────────────────────────────────────
    const sep = document.createElement("div");
    sep.className = "card-separator";
    card.appendChild(sep);

    // ── Bottom section (flags) ────────────────────────────
    const cardBottom = document.createElement("div");
    cardBottom.className = "card-bottom";
    cardBottom.addEventListener("click", (e) => e.stopPropagation());

    // YOLO flag
    const yoloLabel = document.createElement("label");
    yoloLabel.className = "flag-label yolo";
    const yoloCheck = document.createElement("input");
    yoloCheck.type = "checkbox";
    yoloCheck.checked = !!(session.flags && session.flags.yolo);
    yoloCheck.addEventListener("change", async () => {
      await fetch("/api/sessions/" + session.id + "/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yolo: yoloCheck.checked }),
      }).catch(() => {});
    });
    yoloLabel.appendChild(yoloCheck);
    yoloLabel.appendChild(document.createTextNode(" YOLO"));
    cardBottom.appendChild(yoloLabel);

    // Spacer
    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    cardBottom.appendChild(spacer);

    // Args button (placeholder — B3)
    const argsBtn = document.createElement("button");
    argsBtn.className = "args-btn";
    argsBtn.title = "Session arguments (coming soon)";
    argsBtn.textContent = "⋯";
    argsBtn.disabled = true;
    cardBottom.appendChild(argsBtn);

    card.appendChild(cardBottom);
    wrapper.appendChild(card);
    sessionsList.appendChild(wrapper);
  });
}
