// session-ui.js — Wingman session page: context editor, prompt composer, history browser
// Depends on: terminal.js (exposes window.wingmanTerminal)

(function () {
  'use strict';

  // ─── DOM References ─────────────────────────────────

  const contextEditorEl = document.getElementById('contextEditor');
  const contextCharCountEl = document.getElementById('contextCharCount');
  const contextTokenCountEl = document.getElementById('contextTokenCount');
  const sendContextBtn = document.getElementById('sendContextBtn');
  const ctxHistoryListEl = document.getElementById('ctxHistoryList');

  const promptEditorEl = document.getElementById('promptEditor');
  const promptCharCountEl = document.getElementById('promptCharCount');
  const tokenEstimateEl = document.getElementById('tokenEstimate');
  const sendPromptBtn = document.getElementById('sendPromptBtn');
  const clearPromptBtn = document.getElementById('clearPromptBtn');

  const historyListEl = document.getElementById('historyList');
  const historyFooterEl = document.getElementById('historyFooter');
  const historySearchEl = document.getElementById('historySearch');

  const templateBtnEl = document.getElementById('templateBtn');
  const templateDropdownEl = document.getElementById('templateDropdown');
  const stopSessionBtn = document.getElementById('stopSessionBtn');
  const statusMessageEl = document.getElementById('statusMessage');
  const toastContainerEl = document.getElementById('toastContainer');
  const addFileBtnEl = document.getElementById('addFileBtn');
  const attachCopyBtnEl = document.getElementById('attachCopyBtn');

  // ─── State ──────────────────────────────────────────

  let sessionId = null;
  let activeHistoryId = null;
  let historyData = [];
  let ctxHistoryData = [];
  let activeCtxHistoryId = null;
  let contextSent = false;

  // Disable UI until terminal is connected
  sendContextBtn.disabled = true;
  sendPromptBtn.disabled = true;
  clearPromptBtn.disabled = true;
  contextEditorEl.disabled = true;
  promptEditorEl.disabled = true;
  templateBtnEl.disabled = true;

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

  let loadedTemplates = {};

  fetch('/api/config')
    .then(r => r.json())
    .then(config => {
      loadedTemplates = (config && config.templates) ? config.templates : {};
      Object.keys(loadedTemplates).forEach(name => {
        const item = document.createElement('div');
        item.className = 'template-item';
        item.textContent = name.charAt(0).toUpperCase() + name.slice(1);
        item.addEventListener('click', () => {
          contextEditorEl.value = loadedTemplates[name] || '';
          updateContextCounts();
          templateDropdownEl.classList.add('hidden');
        });
        templateDropdownEl.appendChild(item);
      });
    })
    .catch(() => {});

  templateBtnEl.addEventListener('click', (e) => {
    e.stopPropagation();
    templateDropdownEl.classList.toggle('hidden');
  });

  document.addEventListener('click', () => templateDropdownEl.classList.add('hidden'));

  // ─── Context ────────────────────────────────────────

  function updateContextCounts() {
    const n = contextEditorEl.value.length;
    contextCharCountEl.textContent = n.toLocaleString() + ' chars';
    contextTokenCountEl.textContent = '~' + Math.round(n / 4).toLocaleString() + ' tokens';
    if (sessionId) sendContextBtn.disabled = !contextEditorEl.value.trim();
  }

  contextEditorEl.addEventListener('input', updateContextCounts);

  function renderCtxHistory() {
    clearChildren(ctxHistoryListEl);
    if (ctxHistoryData.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding: 24px 12px; text-align: center; color: var(--text-4); font-size: 12px;';
      empty.textContent = 'No context sent yet';
      ctxHistoryListEl.appendChild(empty);
      return;
    }
    ctxHistoryData.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'ctx-history-item' + (entry.id === activeCtxHistoryId ? ' active' : '');

      const preview = document.createElement('div');
      preview.className = 'ctx-history-item-preview';
      preview.textContent = entry.text;

      const meta = document.createElement('div');
      meta.className = 'ctx-history-item-meta';
      const time = document.createElement('span');
      time.textContent = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const tokens = document.createElement('span');
      tokens.textContent = '~' + (entry.tokens || Math.round(entry.text.length / 4)) + ' tok';
      meta.appendChild(time);
      meta.appendChild(tokens);

      item.appendChild(preview);
      item.appendChild(meta);

      item.addEventListener('click', () => {
        activeCtxHistoryId = entry.id;
        contextEditorEl.value = entry.text;
        updateContextCounts();
        renderCtxHistory();
        showToast('Context loaded into editor', 'info');
      });

      ctxHistoryListEl.appendChild(item);
    });
  }

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
        const data = await res.json();
        if (data.entry) {
          ctxHistoryData.unshift(data.entry);
          activeCtxHistoryId = data.entry.id;
          renderCtxHistory();
        }
        setStatus('/ccc sent', 2000);
        contextSent = true;
        const hint = document.getElementById('contextHint');
        if (hint) hint.classList.add('hidden');
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
    if (sessionId) sendPromptBtn.disabled = !promptEditorEl.value.trim();
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
      updatePromptCounts(); // re-evaluates disabled state based on content
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

    const total = historyData.length;
    if (historyFooterEl) historyFooterEl.textContent = total + ' prompt' + (total !== 1 ? 's' : '');

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

  // ─── File Modal (upload + browser) ─────────────────

  const fileModal = document.getElementById('file-modal');
  const fileClose = document.getElementById('file-close');
  const fileDropzone = document.getElementById('fileDropzone');
  const filePickerInput = document.getElementById('filePickerInput');
  const fileUploadResult = document.getElementById('fileUploadResult');
  const fileUploadPath = document.getElementById('fileUploadPath');
  const fileUploadCopyBtn = document.getElementById('fileUploadCopyBtn');
  const fileBrowserToggle = document.getElementById('fileBrowserToggle');
  const fileBrowserSection = document.getElementById('fileBrowserSection');
  const fileBrowserPath = document.getElementById('fileBrowserPath');
  const fileBrowserList = document.getElementById('fileBrowserList');
  const fileSelectedPath = document.getElementById('fileSelectedPath');
  const fileCopyBtn = document.getElementById('fileCopyBtn');

  let selectedFilePath = null;
  let lastUploadedPath = null;

  function closeFileModal() {
    fileModal.classList.add('hidden');
    fileUploadResult.classList.add('hidden');
    fileBrowserSection.classList.add('hidden');
  }
  fileClose.addEventListener('click', closeFileModal);
  fileModal.addEventListener('click', (e) => { if (e.target === fileModal) closeFileModal(); });

  // ── Upload (drag-and-drop + file picker) ──────────

  fileDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropzone.classList.add('dragover');
  });
  fileDropzone.addEventListener('dragleave', () => {
    fileDropzone.classList.remove('dragover');
  });
  fileDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropzone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });

  filePickerInput.addEventListener('change', () => {
    const file = filePickerInput.files[0];
    if (file) uploadFile(file);
    filePickerInput.value = ''; // reset so same file can be picked again
  });

  async function uploadFile(file) {
    fileDropzone.classList.add('uploading');
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1]; // strip data:...;base64,
      try {
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file.name, data: base64 }),
        });
        if (res.ok) {
          const result = await res.json();
          lastUploadedPath = result.path;
          fileUploadPath.textContent = result.path;
          fileUploadResult.classList.remove('hidden');
          // Show the copy button beside the attach button
          attachCopyBtnEl.classList.remove('hidden');
          attachCopyBtnEl.title = 'Copy: ' + result.path;
          showToast('File saved: ' + result.name, 'success');
        } else {
          showToast('Upload failed', 'info');
        }
      } catch (err) {
        console.error(err);
        showToast('Upload failed', 'info');
      } finally {
        fileDropzone.classList.remove('uploading');
      }
    };
    reader.readAsDataURL(file);
  }

  fileUploadCopyBtn.addEventListener('click', () => {
    if (!lastUploadedPath) return;
    copyPathAndClose(lastUploadedPath);
  });

  // Attach copy button (beside attach btn in prompt actions) — copies last attached path
  attachCopyBtnEl.addEventListener('click', () => {
    if (!lastUploadedPath) return;
    navigator.clipboard.writeText(lastUploadedPath).then(() => {
      showToast('Path copied: ' + lastUploadedPath, 'success');
    }).catch(() => {
      // Fallback: insert into prompt editor
      const pos = promptEditorEl.selectionStart;
      const before = promptEditorEl.value.substring(0, pos);
      const after = promptEditorEl.value.substring(promptEditorEl.selectionEnd);
      promptEditorEl.value = before + lastUploadedPath + after;
      promptEditorEl.selectionStart = promptEditorEl.selectionEnd = pos + lastUploadedPath.length;
      updatePromptCounts();
      showToast('Path inserted into prompt', 'info');
    });
  });

  // ── Browse project files ──────────────────────────

  fileBrowserToggle.addEventListener('click', () => {
    const isHidden = fileBrowserSection.classList.contains('hidden');
    fileBrowserSection.classList.toggle('hidden');
    if (isHidden) loadDirectory('.');
  });

  async function loadDirectory(dirPath) {
    fileBrowserList.textContent = 'Loading...';
    selectedFilePath = null;
    fileSelectedPath.textContent = 'Select a file';
    fileSelectedPath.classList.remove('has-file');
    fileCopyBtn.disabled = true;

    try {
      const res = await fetch('/api/files?path=' + encodeURIComponent(dirPath));
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      fileBrowserPath.textContent = data.path || '.';
      fileBrowserList.replaceChildren();

      if (data.path && data.path !== '.') {
        const back = document.createElement('div');
        back.className = 'file-browser-item dir';
        const icon = document.createElement('span');
        icon.className = 'file-browser-item-icon';
        icon.textContent = '\u2190';
        back.appendChild(icon);
        back.appendChild(document.createTextNode('..'));
        back.addEventListener('click', () => {
          const parts = data.path.split('/');
          parts.pop();
          loadDirectory(parts.join('/') || '.');
        });
        fileBrowserList.appendChild(back);
      }

      data.items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'file-browser-item ' + item.type;

        const icon = document.createElement('span');
        icon.className = 'file-browser-item-icon';
        icon.textContent = item.type === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4';
        el.appendChild(icon);
        el.appendChild(document.createTextNode(item.name));

        if (item.type === 'dir') {
          el.addEventListener('click', () => loadDirectory(item.path));
        } else {
          el.addEventListener('click', () => {
            fileBrowserList.querySelectorAll('.selected').forEach(s => s.classList.remove('selected'));
            el.classList.add('selected');
            selectedFilePath = item.path;
            fileSelectedPath.textContent = item.path;
            fileSelectedPath.classList.add('has-file');
            fileCopyBtn.disabled = false;
          });
        }

        fileBrowserList.appendChild(el);
      });

      if (data.items.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'padding: 24px; text-align: center; color: var(--text-4); font-size: 12px;';
        empty.textContent = 'Empty directory';
        fileBrowserList.appendChild(empty);
      }
    } catch (err) {
      fileBrowserList.textContent = 'Failed to load directory';
    }
  }

  fileCopyBtn.addEventListener('click', () => {
    if (!selectedFilePath) return;
    copyPathAndClose(selectedFilePath);
  });

  // ── Shared: copy path to clipboard or insert ──────

  function copyPathAndClose(filePath) {
    lastUploadedPath = filePath; // track for attach copy button
    attachCopyBtnEl.classList.remove('hidden');
    attachCopyBtnEl.title = 'Copy: ' + filePath;
    navigator.clipboard.writeText(filePath).then(() => {
      showToast('Path copied: ' + filePath, 'success');
    }).catch(() => {
      // Fallback: insert into prompt editor
      const pos = promptEditorEl.selectionStart;
      const before = promptEditorEl.value.substring(0, pos);
      const after = promptEditorEl.value.substring(promptEditorEl.selectionEnd);
      promptEditorEl.value = before + filePath + after;
      promptEditorEl.selectionStart = promptEditorEl.selectionEnd = pos + filePath.length;
      updatePromptCounts();
      showToast('Path inserted into prompt', 'info');
    });
    closeFileModal();
  }

  addFileBtnEl.addEventListener('click', () => {
    fileModal.classList.remove('hidden');
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

    // Enable UI now that terminal is connected (send btns stay disabled until content typed)
    clearPromptBtn.disabled = false;
    contextEditorEl.disabled = false;
    promptEditorEl.disabled = false;
    templateBtnEl.disabled = false;
    addFileBtnEl.disabled = false;
    stopSessionBtn.disabled = false;

    // Start with clean editors
    contextEditorEl.value = '';
    promptEditorEl.value = '';
    updateContextCounts();
    updatePromptCounts();

    // Load context (per-session), falling back to default template if blank
    try {
      const ctxRes = await fetch('/api/sessions/' + sid + '/context');
      if (ctxRes.ok) {
        const ctxData = await ctxRes.json();
        if (ctxData.text) contextEditorEl.value = ctxData.text;
      }
    } catch (err) { console.error('Failed to load context:', err); }

    if (!contextEditorEl.value.trim()) {
      try {
        const cfgRes = await fetch('/api/config');
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          const defaultText = cfg.templates && cfg.templates.default;
          if (defaultText) contextEditorEl.value = defaultText;
        }
      } catch (err) { /* non-critical */ }
    }
    updateContextCounts();

    // Load context history
    try {
      const chRes = await fetch('/api/sessions/' + sid + '/context/history');
      if (chRes.ok) {
        ctxHistoryData = await chRes.json();
        ctxHistoryData.reverse();
        if (ctxHistoryData.length > 0) activeCtxHistoryId = ctxHistoryData[0].id;
      }
    } catch (err) { /* non-critical */ }
    renderCtxHistory();

    // If context was already sent in a previous visit, hide the hint
    if (ctxHistoryData.length > 0) {
      contextSent = true;
      const hint = document.getElementById('contextHint');
      if (hint) hint.classList.add('hidden');
    }

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
    setTimeout(() => window.close(), 1000);
    sendContextBtn.disabled = true;
    sendPromptBtn.disabled = true;
    clearPromptBtn.disabled = true;
    contextEditorEl.disabled = true;
    promptEditorEl.disabled = true;
    templateBtnEl.disabled = true;
    addFileBtnEl.disabled = true;
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
    const loadingOverlay = document.getElementById('session-loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    // Re-fit terminal now that overlay is gone and full layout is visible
    if (window.wingmanTerminal && window.wingmanTerminal.fitAddon) {
      requestAnimationFrame(() => window.wingmanTerminal.fitAddon.fit());
    }
    loadSessionData(e.detail.sessionId);
  });

  setStatus('Ready');
})();
