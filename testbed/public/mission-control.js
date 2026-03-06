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
    const label = "Wingman v" + parts[0] + "." + parts[1];
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
    overlayContent.textContent = "Wingman ended.";
  } else {
    // Unexpected connection loss
    shutdownOverlay.classList.remove("hidden");
    overlayContent.textContent = "Connection lost.";
  }
};

ws.onerror = (err) => {
  console.error("WebSocket error:", err);
};

// New Session button — prompt for a name like the Flutter app did
newSessionBtn.addEventListener("click", async () => {
  const description = prompt("Session name:", "Claude Code session");
  if (!description) return; // user cancelled

  newSessionBtn.disabled = true;
  try {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: description.trim() }),
    });
    const data = await res.json();
    if (data.sessionId) {
      window.open("/session/" + data.sessionId, "_blank");
    }
  } catch (err) {
    console.error("Failed to create session:", err);
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

    const card = document.createElement("div");
    card.className = "session-card " + session.status;

    // Left: delete button (non-active sessions only)
    const leftZone = document.createElement("div");
    leftZone.className = "session-left";
    if (!isActive) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn-icon btn-delete";
      deleteBtn.title = "Delete session";
      deleteBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (
          !confirm('Delete session "' + name + '"?\n\nThis cannot be undone.')
        )
          return;
        deleteBtn.disabled = true;
        try {
          await fetch("/api/sessions/" + session.id + "/delete", {
            method: "DELETE",
          });
        } catch (err) {
          console.error("Failed to delete session:", err);
          deleteBtn.disabled = false;
        }
      });
      leftZone.appendChild(deleteBtn);
    }
    card.appendChild(leftZone);

    // Info
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
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    info.appendChild(meta);

    card.appendChild(info);

    // Actions — Open is always available; Stop only when Claude is running
    const actions = document.createElement("div");
    actions.className = "session-actions";

    const openBtn = document.createElement("button");
    openBtn.className = "btn open";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () =>
      window.open("/session/" + session.id, "_blank"),
    );
    actions.appendChild(openBtn);

    if (isActive) {
      const stopBtn = document.createElement("button");
      stopBtn.className = "btn danger";
      stopBtn.textContent = "Stop";
      stopBtn.addEventListener("click", async () => {
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

    card.appendChild(actions);
    sessionsList.appendChild(card);
  });
}
