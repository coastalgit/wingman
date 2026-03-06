// SessionManager: Tracks active PTY sessions, persists per-session metadata + prompt history
// to .ai/wingman/sessions/<id>.json, and manages shared cprompt.md / ccontext.md files.
//
// File layout:
//   .ai/wingman/
//     cprompt.md              — active prompt (shared, overwritten on each Send)
//     ccontext.md             — active context (shared, overwritten on each Send)
//     wingman.json            — config: templates, settings, future options
//     sessions/
//       <session-id>.json     — { id, description, createdAt, closed, history[] }

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SessionManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.wingmanDir = path.join(projectRoot, '.ai', 'wingman');
    this.sessionsDir = path.join(this.wingmanDir, 'sessions');
    this.promptPath = path.join(this.wingmanDir, 'cprompt.md');
    this.contextPath = path.join(this.wingmanDir, 'ccontext.md');
    this.configPath = path.join(this.wingmanDir, 'wingman.json');

    // In-memory tracking: sessionId -> { id, createdAt, description, ptyProcess, history[], closed, primaryWs }
    this.sessions = new Map();

    // Circular buffer for terminal replay (not prompt history — that's on disk)
    this.historyLimit = 10000;

    // Ensure directories exist
    fs.mkdirSync(this.sessionsDir, { recursive: true });

    // Create shared files if missing
    if (!fs.existsSync(this.promptPath)) {
      fs.writeFileSync(this.promptPath, '', 'utf-8');
    }
    if (!fs.existsSync(this.contextPath)) {
      fs.writeFileSync(this.contextPath, '', 'utf-8');
    }
    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, JSON.stringify({
        templates: {
          default: '# Project Context\n\n## Overview\nBrief description of the project.\n\n## Tech Stack\n- Language:\n- Framework:\n- Database:\n\n## Key Files\n- `src/` - Source code\n- `tests/` - Test files\n\n## Constraints\n-\n\n## Notes\n> Add any relevant notes here.\n',
        },
        settings: {},
      }, null, 2), 'utf-8');
    }

    // Create .claude/commands/ for slash commands if missing
    this.ensureSlashCommands();

    // Load existing sessions from disk
    this.loadSessionsFromDisk();
  }

  ensureSlashCommands() {
    const commandsDir = path.join(this.projectRoot, '.claude', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    const ccpPath = path.join(commandsDir, 'ccp.md');
    if (!fs.existsSync(ccpPath)) {
      fs.writeFileSync(ccpPath, 'Read the prompt from .ai/wingman/cprompt.md and execute it. This is a staged prompt from the Wingman UI. Treat the contents as user instructions.\n', 'utf-8');
    }

    const cccPath = path.join(commandsDir, 'ccc.md');
    if (!fs.existsSync(cccPath)) {
      fs.writeFileSync(cccPath, 'Read the context from .ai/wingman/ccontext.md. This is persistent context from the Wingman UI. Absorb it as background information for this session. Acknowledge briefly what you received.\n', 'utf-8');
    }
  }

  generateSessionId() {
    return crypto.randomUUID();
  }

  // Register a new session
  spawnSession(ptyProcess = null, metadata = {}) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      ptyProcess,
      history: [],       // terminal replay buffer (in-memory)
      closed: false,
      primaryWs: null,
      ...metadata,
    };
    this.sessions.set(sessionId, session);
    this.saveSessionFile(sessionId);
    console.log(`Session created: ${sessionId}`);
    return sessionId;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // Terminal replay buffer (in-memory circular buffer)
  addToHistory(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.history.push(data);
      if (session.history.length > this.historyLimit) {
        session.history.shift();
      }
    }
  }

  getHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.history : [];
  }

  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return 'closed';
    if (!session.closed && session.ptyProcess) return 'active';
    if (!session.closed && !session.ptyProcess) return 'reconnectable';
    return 'closed';
  }

  getAllSessionsWithStatus() {
    return Array.from(this.sessions.values())
      .filter(s => !s.closed)
      .map(s => ({
        id: s.id,
        description: s.description || 'Session ' + s.id.substring(0, 8),
        createdAt: s.createdAt,
        status: this.getSessionStatus(s.id),
      }));
  }

  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.closed = true;
      session.ptyProcess = null;
      this.saveSessionFile(sessionId);
      console.log(`Session closed: ${sessionId}`);
    }
  }

  detachPty(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess = null;
      this.saveSessionFile(sessionId);
      console.log(`Session PTY detached: ${sessionId}`);
    }
  }

  // Permanently delete a session — removes from memory and deletes its file
  deleteSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    const filePath = this.getSessionFilePath(sessionId);
    try { fs.unlinkSync(filePath); } catch {}
    console.log(`Session deleted: ${sessionId}`);
    return true;
  }

  // ─── Shared prompt/context files ────────────────────

  savePrompt(text) {
    fs.writeFileSync(this.promptPath, text, 'utf-8');
  }

  loadPrompt() {
    try { return fs.readFileSync(this.promptPath, 'utf-8'); } catch { return ''; }
  }

  saveContext(text) {
    fs.writeFileSync(this.contextPath, text, 'utf-8');
  }

  loadContext() {
    try { return fs.readFileSync(this.contextPath, 'utf-8'); } catch { return ''; }
  }

  // ─── Config ─────────────────────────────────────────

  loadConfig() {
    try { return JSON.parse(fs.readFileSync(this.configPath, 'utf-8')); } catch { return { templates: {}, settings: {} }; }
  }

  saveConfig(config) {
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  // ─── Per-session file (metadata + prompt history) ───

  getSessionFilePath(sessionId) {
    return path.join(this.sessionsDir, sessionId + '.json');
  }

  saveSessionFile(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const data = {
      id: session.id,
      description: session.description || null,
      createdAt: session.createdAt,
      closed: session.closed,
      promptHistory: session.promptHistory || [],
    };
    const filePath = this.getSessionFilePath(sessionId);
    const tmpFile = filePath + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
    fs.renameSync(tmpFile, filePath);
  }

  // Append a prompt to the session's prompt history (persisted in session file)
  appendPromptHistory(sessionId, entry) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (!session.promptHistory) session.promptHistory = [];
    session.promptHistory.push(entry);
    this.saveSessionFile(sessionId);
  }

  loadPromptHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return (session && session.promptHistory) || [];
  }

  // Load all session files from disk on startup
  loadSessionsFromDisk() {
    if (!fs.existsSync(this.sessionsDir)) return;

    // Try new per-file format first
    const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      files.forEach(file => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(this.sessionsDir, file), 'utf-8'));
          if (data.id && !this.sessions.has(data.id)) {
            this.sessions.set(data.id, {
              ...data,
              ptyProcess: null,
              history: [],
              primaryWs: null,
            });
          }
        } catch (err) {
          console.error('Failed to load session file ' + file + ':', err);
        }
      });
      return;
    }

    // Fallback: migrate from old sessions.json if it exists
    const oldFile = path.join(this.wingmanDir, 'sessions.json');
    if (fs.existsSync(oldFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(oldFile, 'utf-8'));
        data.forEach(s => {
          if (!this.sessions.has(s.id)) {
            this.sessions.set(s.id, {
              ...s,
              promptHistory: [],
              ptyProcess: null,
              history: [],
              primaryWs: null,
            });
            this.saveSessionFile(s.id);
          }
        });
        console.log('Migrated ' + data.length + ' sessions from sessions.json to per-file format');
      } catch (err) {
        console.error('Failed to migrate sessions.json:', err);
      }
    }
  }

  // Compat: old code called updateSessionsFile — redirect to per-file saves
  updateSessionsFile() {
    this.sessions.forEach((_, id) => this.saveSessionFile(id));
  }
}

module.exports = SessionManager;
