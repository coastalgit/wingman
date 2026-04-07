// mission-control.js — Wingman Mission Control dashboard client

const sessionsList = document.getElementById("sessions-list");
const newSessionBtn = document.getElementById("new-session-btn");
const exitBtn = document.getElementById("exit-btn");
const shutdownOverlay = document.getElementById("shutdown-overlay");
const modeBanner = document.getElementById("mode-banner");

let isManualMode = false;

// Fetch version + project name and update status bar + header
Promise.all([
  fetch("/api/version").then((r) => r.json()).catch(() => ({})),
  fetch("/api/project-info").then((r) => r.json()).catch(() => ({})),
]).then(([verData, projData]) => {
  const parts = (verData.version || "").split(".");
  const ver = parts.length >= 2 ? "v" + parts[0] + "." + parts[1] : "";
  const build = verData.build ? " b" + verData.build : "";
  const proj = projData.name || "";

  const el = document.getElementById("statusProject");
  if (el) el.textContent = "Wingman " + ver + " build " + (verData.build || 0);

  // Centered project name in footer
  const projEl = document.getElementById("statusProjectName");
  if (projEl && proj) projEl.textContent = proj;

  // Show project name in header title
  const title = document.querySelector(".header-title");
  if (title && proj) title.textContent = "Mission Control — " + proj;
});

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

// New Session button — prompt for name, create card on MC (no auto-open)
newSessionBtn.addEventListener("click", async () => {
  const description = prompt("Session name:", "Claude Code session");
  if (!description) return; // user cancelled

  newSessionBtn.disabled = true;
  try {
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: description.trim() }),
    });
  } catch (err) {
    console.error("Failed to create session:", err);
  } finally {
    newSessionBtn.disabled = false;
  }
});

// ─── Settings Modal ─────────────────────────────────

const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsClose = document.getElementById("settings-close");
const settingsCancel = document.getElementById("settings-cancel");
const settingsSave = document.getElementById("settings-save");
const defaultFileDirInput = document.getElementById("defaultFileDirInput");

const workspaceNameInput = document.getElementById("workspaceNameInput");

settingsBtn.addEventListener("click", () => {
  fetch("/api/config")
    .then(r => r.json())
    .then(cfg => {
      const dir = (cfg.settings && cfg.settings.defaultFileDir) || "docs/promptfiles/";
      defaultFileDirInput.value = dir;
      workspaceNameInput.value = (cfg.settings && cfg.settings.workspaceName) || "";
    })
    .catch(() => {});
  settingsModal.classList.remove("hidden");
});

function closeSettingsModal() {
  settingsModal.classList.add("hidden");
}

settingsClose.addEventListener("click", closeSettingsModal);
settingsCancel.addEventListener("click", closeSettingsModal);
settingsModal.addEventListener("click", (e) => { if (e.target === settingsModal) closeSettingsModal(); });

settingsSave.addEventListener("click", async () => {
  const dir = defaultFileDirInput.value.trim() || "docs/promptfiles/";
  const wsName = workspaceNameInput.value.trim();
  settingsSave.disabled = true;
  try {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultFileDir: dir, workspaceName: wsName || null }),
    });
    // Update header and footer immediately with new name
    fetch("/api/project-info").then(r => r.json()).then(data => {
      const title = document.querySelector(".header-title");
      if (title) title.textContent = "Mission Control — " + (data.name || "");
      const projEl = document.getElementById("statusProjectName");
      if (projEl) projEl.textContent = data.name || "";
    }).catch(() => {});
    closeSettingsModal();
  } catch (err) {
    console.error("Failed to save settings:", err);
  } finally {
    settingsSave.disabled = false;
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

// ─── Args Editor Modal ──────────────────────────────

const argsModal = document.getElementById("args-modal");
const argsClose = document.getElementById("args-close");
const argsCancel = document.getElementById("args-cancel");
const argsSave = document.getElementById("args-save");
const argsFlagsList = document.getElementById("argsFlagsList");
const argsStatus = document.getElementById("argsStatus");
const argsModalTitle = document.getElementById("argsModalTitle");

let argsSessionId = null;
let claudeFlags = null;

function closeArgsModal() { argsModal.classList.add("hidden"); }
argsClose.addEventListener("click", closeArgsModal);
argsCancel.addEventListener("click", closeArgsModal);
argsModal.addEventListener("click", (e) => { if (e.target === argsModal) closeArgsModal(); });

async function openArgsModal(sessionId, sessionDesc) {
  argsSessionId = sessionId;
  argsModalTitle.textContent = "Arguments — " + (sessionDesc || "Session");
  argsStatus.textContent = "";
  argsModal.classList.remove("hidden");

  // Fetch flags definition (cached after first call)
  if (!claudeFlags) {
    argsFlagsList.textContent = "Loading flags...";
    try {
      const res = await fetch("/api/claude-flags");
      claudeFlags = await res.json();
    } catch { claudeFlags = []; }
  }

  // Load existing customArgs for this session
  let existingArgs = {};
  try {
    const res = await fetch("/api/sessions/" + sessionId);
    // We get the full session list and find ours
  } catch {}
  // Get flags from session data via the sessions list
  try {
    const res = await fetch("/api/sessions");
    const sessions = await res.json();
    const sess = sessions.find(s => s.id === sessionId);
    if (sess && sess.flags && sess.flags.customArgs) existingArgs = sess.flags.customArgs;
  } catch {}

  renderArgsFlags(existingArgs);
}

function renderArgsFlags(existingArgs) {
  argsFlagsList.replaceChildren();
  if (!claudeFlags || claudeFlags.length === 0) {
    argsFlagsList.textContent = "No flags available";
    return;
  }

  claudeFlags.forEach(flag => {
    const row = document.createElement("div");
    row.className = "args-flag-row";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "args-flag-check";
    check.dataset.flag = flag.long;

    const info = document.createElement("div");
    info.className = "args-flag-info";

    const name = document.createElement("div");
    name.className = "args-flag-name";
    name.textContent = flag.long + (flag.short ? " (" + flag.short + ")" : "");
    info.appendChild(name);

    const desc = document.createElement("div");
    desc.className = "args-flag-desc";
    desc.textContent = flag.desc;
    info.appendChild(desc);

    let valueInput = null;
    if (flag.value || flag.choices) {
      const valueDiv = document.createElement("div");
      valueDiv.className = "args-flag-value";
      valueDiv.style.display = "none";

      if (flag.choices) {
        valueInput = document.createElement("select");
        const emptyOpt = document.createElement("option");
        emptyOpt.value = "";
        emptyOpt.textContent = "— select —";
        valueInput.appendChild(emptyOpt);
        flag.choices.forEach(c => {
          const opt = document.createElement("option");
          opt.value = c;
          opt.textContent = c;
          valueInput.appendChild(opt);
        });
      } else {
        valueInput = document.createElement("input");
        valueInput.type = "text";
        valueInput.placeholder = flag.value || "value";
      }
      valueInput.dataset.flag = flag.long;
      valueDiv.appendChild(valueInput);
      info.appendChild(valueDiv);

      check.addEventListener("change", () => {
        valueDiv.style.display = check.checked ? "block" : "none";
        if (check.checked && valueInput.tagName === "INPUT") valueInput.focus();
      });
    }

    // Pre-fill from existing args
    const existing = existingArgs[flag.long];
    if (existing !== undefined) {
      check.checked = true;
      if (valueInput) {
        valueInput.parentElement.style.display = "block";
        if (typeof existing === "string") valueInput.value = existing;
      }
    }

    row.appendChild(check);
    row.appendChild(info);
    argsFlagsList.appendChild(row);
  });
}

argsSave.addEventListener("click", async () => {
  if (!argsSessionId) return;
  const customArgs = {};
  argsFlagsList.querySelectorAll(".args-flag-check:checked").forEach(check => {
    const flag = check.dataset.flag;
    const row = check.closest(".args-flag-row");
    const input = row.querySelector(".args-flag-value input, .args-flag-value select");
    if (input && input.value.trim()) {
      customArgs[flag] = input.value.trim();
    } else if (!input) {
      customArgs[flag] = true;
    } else {
      customArgs[flag] = true;
    }
  });

  argsSave.disabled = true;
  try {
    await fetch("/api/sessions/" + argsSessionId + "/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customArgs }),
    });
    const count = Object.keys(customArgs).length;
    argsStatus.textContent = count > 0 ? count + " flag" + (count !== 1 ? "s" : "") + " saved" : "Flags cleared";
    setTimeout(closeArgsModal, 600);
  } catch (err) {
    console.error("Failed to save args:", err);
    argsStatus.textContent = "Save failed";
  } finally {
    argsSave.disabled = false;
  }
});

let selectedSessionId = null;

// Track in-flight flag saves per session so Open waits for them
const pendingFlagSaves = new Map();

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
    card.addEventListener("dblclick", async () => {
      const pending = pendingFlagSaves.get(session.id);
      if (pending) await pending;
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
    openBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      // Wait for any in-flight flag save to complete before opening
      const pending = pendingFlagSaves.get(session.id);
      if (pending) await pending;
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

    // YOLO flag (mutually exclusive with Auto)
    const yoloLabel = document.createElement("label");
    yoloLabel.className = "flag-label yolo";
    const yoloCheck = document.createElement("input");
    yoloCheck.type = "checkbox";
    yoloCheck.checked = !!(session.flags && session.flags.yolo);
    yoloLabel.appendChild(yoloCheck);
    yoloLabel.appendChild(document.createTextNode(" YOLO"));
    cardBottom.appendChild(yoloLabel);

    // Auto Mode flag (mutually exclusive with YOLO)
    const autoLabel = document.createElement("label");
    autoLabel.className = "flag-label auto";
    const autoCheck = document.createElement("input");
    autoCheck.type = "checkbox";
    autoCheck.checked = !!(session.flags && session.flags.autoMode);
    autoLabel.appendChild(autoCheck);
    autoLabel.appendChild(document.createTextNode(" Auto"));
    cardBottom.appendChild(autoLabel);

    // Save flags with tracking so Open can wait for completion
    function saveFlags(sid, flagData) {
      const p = fetch("/api/sessions/" + sid + "/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flagData),
      }).catch(() => {}).finally(() => {
        if (pendingFlagSaves.get(sid) === p) pendingFlagSaves.delete(sid);
      });
      pendingFlagSaves.set(sid, p);
    }

    // Mutual exclusion: ticking one unticks the other
    yoloCheck.addEventListener("change", () => {
      if (yoloCheck.checked) autoCheck.checked = false;
      saveFlags(session.id, { yolo: yoloCheck.checked, autoMode: false });
    });
    autoCheck.addEventListener("change", () => {
      if (autoCheck.checked) yoloCheck.checked = false;
      saveFlags(session.id, { autoMode: autoCheck.checked, yolo: false });
    });

    // With Chrome flag
    const chromeLabel = document.createElement("label");
    chromeLabel.className = "flag-label chrome";
    const chromeCheck = document.createElement("input");
    chromeCheck.type = "checkbox";
    chromeCheck.checked = !!(session.flags && session.flags.withChrome);
    chromeCheck.addEventListener("change", () => {
      saveFlags(session.id, { withChrome: chromeCheck.checked });
    });
    chromeLabel.appendChild(chromeCheck);
    chromeLabel.appendChild(document.createTextNode(" Chrome"));
    cardBottom.appendChild(chromeLabel);

    // Spacer
    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    cardBottom.appendChild(spacer);

    // Args button
    const argsBtn = document.createElement("button");
    const hasArgs = session.flags && session.flags.customArgs && Object.keys(session.flags.customArgs).length > 0;
    argsBtn.className = "args-btn" + (hasArgs ? " has-args" : "");
    argsBtn.title = hasArgs ? Object.keys(session.flags.customArgs).join(", ") : "Edit session arguments";
    argsBtn.textContent = "⋯";
    argsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openArgsModal(session.id, session.description);
    });
    cardBottom.appendChild(argsBtn);

    card.appendChild(cardBottom);
    wrapper.appendChild(card);
    sessionsList.appendChild(wrapper);
  });
}
