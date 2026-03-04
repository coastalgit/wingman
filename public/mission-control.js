// mission-control.js — Wingman Mission Control dashboard client

const sessionsList = document.getElementById('sessions-list');
const newSessionBtn = document.getElementById('new-session-btn');
const exitBtn = document.getElementById('exit-btn');
const shutdownOverlay = document.getElementById('shutdown-overlay');

// WebSocket connection to server
const ws = new WebSocket('ws://' + location.host);

ws.onopen = () => {
  // Identify as Mission Control client
  ws.send(JSON.stringify({ type: 'mc-connect' }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'session-update') {
    renderSessions(msg.sessions);
    const active = (msg.sessions || []).filter(s => s.status === 'active').length;
    const el = document.getElementById('statusSessions');
    if (el) el.textContent = active + ' active session' + (active !== 1 ? 's' : '');
  }

  if (msg.type === 'shutdown') {
    shutdownOverlay.classList.remove('hidden');
    newSessionBtn.disabled = true;
    exitBtn.disabled = true;
  }
};

ws.onclose = () => {
  // If not already showing shutdown overlay, show disconnect state
  if (shutdownOverlay.classList.contains('hidden')) {
    shutdownOverlay.classList.remove('hidden');
    document.querySelector('.overlay-content').textContent = 'Connection lost.';
  }
};

ws.onerror = (err) => {
  console.error('WebSocket error:', err);
};

// New Session button — prompt for a name like the Flutter app did
newSessionBtn.addEventListener('click', async () => {
  const description = prompt('Session name:', 'Claude Code session');
  if (!description) return; // user cancelled

  newSessionBtn.disabled = true;
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: description.trim() }),
    });
    const data = await res.json();
    if (data.sessionId) {
      window.open('/session/' + data.sessionId, '_blank');
    }
  } catch (err) {
    console.error('Failed to create session:', err);
  } finally {
    newSessionBtn.disabled = false;
  }
});

// Exit Wingman button
exitBtn.addEventListener('click', async () => {
  exitBtn.disabled = true;
  newSessionBtn.disabled = true;
  try {
    await fetch('/api/shutdown', { method: 'POST' });
  } catch (err) {
    // Server is shutting down, connection errors are expected
  }
});

// Render session cards using DOM methods (no innerHTML for security)
function renderSessions(sessions) {
  // Clear existing content
  sessionsList.replaceChildren();

  if (!sessions || sessions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = "No sessions. Click 'New Session' to start.";
    sessionsList.appendChild(empty);
    return;
  }

  sessions.forEach((session) => {
    const card = document.createElement('div');
    card.className = 'session-card';

    // Info section
    const info = document.createElement('div');
    info.className = 'session-info';

    const desc = document.createElement('div');
    desc.className = 'session-description';
    desc.textContent = session.description || 'Unnamed session';
    info.appendChild(desc);

    const meta = document.createElement('div');
    meta.className = 'session-meta';
    const created = new Date(session.createdAt).toLocaleString();
    meta.textContent = created;
    info.appendChild(meta);

    card.appendChild(info);

    // Status badge
    const badge = document.createElement('span');
    badge.className = 'status-badge ' + session.status;
    badge.textContent = session.status;
    card.appendChild(badge);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'session-actions';

    if (session.status === 'active') {
      const openBtn = document.createElement('button');
      openBtn.className = 'btn secondary';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => {
        window.open('/session/' + session.id, '_blank');
      });
      actions.appendChild(openBtn);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn danger';
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', async () => {
        closeBtn.disabled = true;
        try {
          await fetch('/api/sessions/' + session.id, { method: 'DELETE' });
        } catch (err) {
          console.error('Failed to close session:', err);
          closeBtn.disabled = false;
        }
      });
      actions.appendChild(closeBtn);
    }

    if (session.status === 'reconnectable') {
      const openBtn = document.createElement('button');
      openBtn.className = 'btn secondary';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => {
        window.open('/session/' + session.id, '_blank');
      });
      actions.appendChild(openBtn);
    }

    // Closed sessions: no action buttons

    card.appendChild(actions);
    sessionsList.appendChild(card);
  });
}
