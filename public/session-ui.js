// session-ui.js — Wingman session page: context editor, prompt composer, history browser
// Depends on: terminal.js (exposes window.wingmanTerminal)

(function () {
  'use strict';

  // ─── DOM References ─────────────────────────────────

  const contextEditorEl = document.getElementById('contextEditor');
  const contextPreviewEl = document.getElementById('contextPreview');
  const contextCharCountEl = document.getElementById('contextCharCount');
  const contextTokenCountEl = document.getElementById('contextTokenCount');
  const sendContextBtn = document.getElementById('sendContextBtn');

  const promptEditorEl = document.getElementById('promptEditor');
  const promptCharCountEl = document.getElementById('promptCharCount');
  const tokenEstimateEl = document.getElementById('tokenEstimate');
  const sendPromptBtn = document.getElementById('sendPromptBtn');
  const clearPromptBtn = document.getElementById('clearPromptBtn');

  const historyListEl = document.getElementById('historyList');
  const historySearchEl = document.getElementById('historySearch');

  const templateSelectEl = document.getElementById('templateSelect');
  const stopSessionBtn = document.getElementById('stopSessionBtn');
  const statusMessageEl = document.getElementById('statusMessage');
  const toastContainerEl = document.getElementById('toastContainer');

  // ─── State ──────────────────────────────────────────

  let sessionId = null;
  let activeHistoryId = null;
  let historyData = [];

  // Disable UI until terminal is connected
  sendContextBtn.disabled = true;
  sendPromptBtn.disabled = true;
  clearPromptBtn.disabled = true;
  contextEditorEl.disabled = true;
  promptEditorEl.disabled = true;

  // ─── Helpers ────────────────────────────────────────

  function clearChildren(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function showToast(message, type) {
    type = type || 'info';
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = document.createElement('span');
    icon.textContent = type === 'success' ? '\u2713' : '\u2139';
    toast.appendChild(icon);
    toast.appendChild(document.createTextNode(' ' + message));
    toastContainerEl.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastOut 0.2s ease forwards';
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  function setStatus(msg, duration) {
    statusMessageEl.textContent = msg;
    if (duration) setTimeout(() => { statusMessageEl.textContent = 'Ready'; }, duration);
  }

  // ─── Templates ──────────────────────────────────────

  fetch('/api/config')
    .then(r => r.json())
    .then(config => {
      const templates = config && config.templates ? config.templates : {};
      Object.keys(templates).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        templateSelectEl.appendChild(opt);
      });
    })
    .catch(() => {});

  templateSelectEl.addEventListener('change', () => {
    const name = templateSelectEl.value;
    if (!name) return;
    fetch('/api/config')
      .then(r => r.json())
      .then(config => {
        const text = config && config.templates && config.templates[name];
        if (text) {
          contextEditorEl.value = text;
          renderContextPreview();
          updateContextCounts();
        }
        templateSelectEl.value = '';
      })
      .catch(() => {});
  });

  // ─── Context ────────────────────────────────────────

  function renderContextPreview() {
    const md = contextEditorEl.value;
    if (!md.trim()) {
      clearChildren(contextPreviewEl);
      const p = document.createElement('p');
      p.className = 'preview-empty';
      p.textContent = 'Start typing to see a live preview...';
      contextPreviewEl.appendChild(p);
      return;
    }
    try {
      contextPreviewEl.innerHTML = marked.parse(md);
    } catch {
      clearChildren(contextPreviewEl);
      const p = document.createElement('p');
      p.style.color = 'var(--danger)';
      p.textContent = 'Markdown parse error';
      contextPreviewEl.appendChild(p);
    }
  }

  function updateContextCounts() {
    const n = contextEditorEl.value.length;
    contextCharCountEl.textContent = n.toLocaleString() + ' chars';
    contextTokenCountEl.textContent = '~' + Math.round(n / 4).toLocaleString() + ' tokens';
  }

  contextEditorEl.addEventListener('input', () => {
    renderContextPreview();
    updateContextCounts();
  });

  sendContextBtn.addEventListener('click', async () => {
    if (!sessionId) return;
    const text = contextEditorEl.value.trim();
    if (!text) { showToast('Write context first', 'info'); return; }

    sendContextBtn.disabled = true;
    setStatus('Sending context...');
    try {
      const res = await fetch('/api/sessions/' + sessionId + '/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: contextEditorEl.value }),
      });
      if (res.ok) {
        setStatus('/ccc sent', 2000);
      } else {
        showToast('Failed to send context', 'info');
        setStatus('Ready');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error', 'info');
      setStatus('Ready');
    } finally {
      sendContextBtn.disabled = false;
    }
  });

  // ─── Prompts ────────────────────────────────────────

  function updatePromptCounts() {
    const n = promptEditorEl.value.length;
    promptCharCountEl.textContent = n.toLocaleString() + ' chars';
    tokenEstimateEl.textContent = '~' + Math.round(n / 4).toLocaleString() + ' tokens';
  }

  promptEditorEl.addEventListener('input', updatePromptCounts);

  sendPromptBtn.addEventListener('click', async () => {
    const text = promptEditorEl.value.trim();
    if (!text) { showToast('Write a prompt first', 'info'); return; }
    if (!sessionId) return;

    sendPromptBtn.disabled = true;
    setStatus('Sending prompt...');
    try {
      const res = await fetch('/api/sessions/' + sessionId + '/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        promptEditorEl.value = '';
        updatePromptCounts();

        if (data.entry) {
          historyData.unshift(data.entry);
          activeHistoryId = data.entry.id;
        }
        renderHistory(historySearchEl.value);
        setStatus('/ccp sent', 2000);
      } else {
        showToast('Failed to send prompt', 'info');
        setStatus('Ready');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error', 'info');
      setStatus('Ready');
    } finally {
      sendPromptBtn.disabled = false;
    }
  });

  clearPromptBtn.addEventListener('click', () => {
    promptEditorEl.value = '';
    activeHistoryId = null;
    updatePromptCounts();
    renderHistory(historySearchEl.value);
  });

  // ─── History ────────────────────────────────────────

  function renderHistory(filter) {
    filter = (filter || '').toLowerCase();
    const filtered = filter
      ? historyData.filter(p => p.text.toLowerCase().includes(filter))
      : historyData;

    clearChildren(historyListEl);

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 24px 12px; text-align: center; color: var(--text-4); font-size: 12px;';
      empty.textContent = filter ? 'No matching prompts' : 'No prompt history yet';
      historyListEl.appendChild(empty);
      return;
    }

    filtered.forEach(prompt => {
      const item = document.createElement('div');
      item.className = 'history-item' + (prompt.id === activeHistoryId ? ' active' : '');

      const text = document.createElement('div');
      text.className = 'history-item-text';
      text.textContent = prompt.text;

      const meta = document.createElement('div');
      meta.className = 'history-item-meta';
      const time = document.createElement('span');
      time.textContent = new Date(prompt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tokens = document.createElement('span');
      tokens.textContent = '~' + (prompt.tokens || Math.round(prompt.text.length / 4)) + ' tokens';
      meta.appendChild(time);
      meta.appendChild(tokens);

      item.appendChild(text);
      item.appendChild(meta);

      item.addEventListener('click', () => {
        activeHistoryId = prompt.id;
        promptEditorEl.value = prompt.text;
        updatePromptCounts();
        renderHistory(historySearchEl.value);
        setActiveFeature('prompts');
        showToast('Prompt loaded into editor', 'info');
      });

      historyListEl.appendChild(item);
    });
  }

  historySearchEl.addEventListener('input', () => {
    renderHistory(historySearchEl.value);
  });

  // ─── Stop Session ───────────────────────────────────

  stopSessionBtn.addEventListener('click', async () => {
    if (!sessionId) return;
    stopSessionBtn.disabled = true;
    try {
      await fetch('/api/sessions/' + sessionId, { method: 'DELETE' });
      showToast('Session stopped', 'info');
    } catch (err) {
      console.error(err);
      stopSessionBtn.disabled = false;
    }
  });

  // ─── Tab Switching ──────────────────────────────────

  function setActiveFeature(feature) {
    document.querySelectorAll('.feature-nav-btn').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.feature === feature);
    });
    document.getElementById('contextPanel').classList.toggle('active', feature === 'context');
    document.getElementById('promptsPanel').classList.toggle('active', feature === 'prompts');
  }

  document.querySelectorAll('.feature-nav-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.feature) setActiveFeature(tab.dataset.feature);
    });
  });

  // ─── Keyboard Shortcuts ─────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      sendPromptBtn.click();
    }
  });

  [contextEditorEl, promptEditorEl].forEach(textarea => {
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
        textarea.dispatchEvent(new Event('input'));
      }
    });
  });

  // ─── Terminal Gutter Drag Resize ────────────────────

  const gutter = document.getElementById('terminalGutter');
  const mainContent = document.querySelector('.main-content');
  const terminalSection = document.querySelector('.terminal-section');

  let dragging = false;

  gutter.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const appBody = document.querySelector('.app-body');
    const rect = appBody.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const totalH = rect.height - 4;
    const editorH = Math.max(100, Math.min(totalH - 150, offsetY));
    const termH = totalH - editorH;
    mainContent.style.flex = 'none';
    mainContent.style.height = editorH + 'px';
    terminalSection.style.flex = 'none';
    terminalSection.style.height = termH + 'px';
    if (window.wingmanTerminal && window.wingmanTerminal.fitAddon) {
      window.wingmanTerminal.fitAddon.fit();
    }
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (window.wingmanTerminal && window.wingmanTerminal.fitAddon) {
        window.wingmanTerminal.fitAddon.fit();
      }
    }
  });

  // ─── Load Data from API ─────────────────────────────

  async function loadSessionData(sid) {
    sessionId = sid;

    // Enable UI now that terminal is connected
    sendContextBtn.disabled = false;
    sendPromptBtn.disabled = false;
    clearPromptBtn.disabled = false;
    contextEditorEl.disabled = false;
    promptEditorEl.disabled = false;
    templateSelectEl.disabled = false;
    stopSessionBtn.disabled = false;

    // Start with clean editors — shared files belong to whoever last sent,
    // not to this session. Context and prompt editors start blank.
    contextEditorEl.value = '';
    promptEditorEl.value = '';
    renderContextPreview();
    updateContextCounts();
    updatePromptCounts();

    // Load context (shared file) and restore editor
    try {
      const ctxRes = await fetch('/api/sessions/' + sid + '/context');
      if (ctxRes.ok) {
        const ctxData = await ctxRes.json();
        if (ctxData.text) {
          contextEditorEl.value = ctxData.text;
          renderContextPreview();
          updateContextCounts();
        }
      }
    } catch (err) { console.error('Failed to load context:', err); }

    // Load prompt history (per-session)
    try {
      const res = await fetch('/api/sessions/' + sid + '/history');
      if (res.ok) {
        historyData = await res.json();
        historyData.reverse();
        renderHistory();
      }
    } catch (err) { console.error('Failed to load history:', err); }
  }

  // ─── Session Ended Overlay ───────────────────────────

  window.addEventListener('wingman-session-ended', () => {
    const overlay = document.getElementById('session-ended-overlay');
    if (overlay) overlay.classList.remove('hidden');
    sendContextBtn.disabled = true;
    sendPromptBtn.disabled = true;
    clearPromptBtn.disabled = true;
    contextEditorEl.disabled = true;
    promptEditorEl.disabled = true;
    templateSelectEl.disabled = true;
    stopSessionBtn.disabled = true;
  });

  // ─── Version Display ─────────────────────────────────

  fetch('/api/version')
    .then(r => r.json())
    .then(data => {
      if (!data.version) return;
      const parts = data.version.split('.');
      const label = 'Wingman v' + parts[0] + '.' + parts[1];
      const el = document.getElementById('statusProject');
      if (el) el.textContent = label;
    })
    .catch(() => {});

  // ─── Initialize ─────────────────────────────────────

  window.addEventListener('wingman-session-ready', (e) => {
    loadSessionData(e.detail.sessionId);
  });

  setStatus('Ready');
})();
