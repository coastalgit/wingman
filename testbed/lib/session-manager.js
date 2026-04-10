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
    this.configPath = path.join(this.wingmanDir, 'wingman.json');

    // In-memory tracking: sessionId -> { id, createdAt, description, ptyProcess, history[], closed, primaryWs }
    this.sessions = new Map();

    // Circular buffer for terminal replay (not prompt history — that's on disk)
    this.historyLimit = 10000;

    // Ensure directories exist
    fs.mkdirSync(this.sessionsDir, { recursive: true });

    // Config: create if missing, upgrade if outdated
    const CONFIG_VERSION = 2;
    const defaultTemplates = {
      default: '# Session Context\n\n## Overview of intent for session\n- Brief description of the project.\n\n## Key Files\n- `src/` - Source code\n- `tests/` - Test files\n\n## Constraints\n- Restrictions\n\n## Notes\n- Add any relevant notes here.\n',
      seshmemLoader: '# Session Memory Loader\n\nTo restore context from a previous session, run the following in your Claude Code terminal:\n\n```\n/seshmem:load\n```\n\n## Load Options\n- `/seshmem:load` — loads the most recent checkpoint\n- `/seshmem:load 3` — loads the last 3 checkpoints (shows progression)\n- `/seshmem:load <filename>` — loads a specific checkpoint by name (without .md)\n\n## Extra Seshmem Load Arguments\n> Add any additional context or instructions for the session memory load here.\n',
    };

    if (!fs.existsSync(this.configPath)) {
      fs.writeFileSync(this.configPath, JSON.stringify({
        configVersion: CONFIG_VERSION,
        templates: defaultTemplates,
        settings: {},
      }, null, 2), 'utf-8');
    } else {
      // Upgrade existing config if version is older
      try {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        if (!config.configVersion || config.configVersion < CONFIG_VERSION) {
          config.configVersion = CONFIG_VERSION;
          config.templates = { ...defaultTemplates, ...(config.templates || {}) };
          // Overwrite built-in templates with latest versions
          config.templates.default = defaultTemplates.default;
          config.templates.seshmemLoader = defaultTemplates.seshmemLoader;
          fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
          console.log('Config upgraded to version ' + CONFIG_VERSION);
        }
      } catch (err) {
        console.error('Failed to upgrade config:', err);
      }
    }

    // Create .claude/commands/ for slash commands if missing
    this.ensureSlashCommands();

    // Load existing sessions from disk
    this.loadSessionsFromDisk();
  }

  ensureSlashCommands() {
    const commandsDir = path.join(this.projectRoot, '.claude', 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });

    // Always overwrite to ensure latest content (version updates, bug fixes)
    // $ARGUMENTS receives the per-session filename passed by Wingman when injecting the command.
    // If no argument is given (manual invocation), fall back to the legacy shared files.
    const ccpContent = 'IMPORTANT: Read the prompt file from the Wingman UI. The file path is: .ai/wingman/$ARGUMENTS — if that path is blank or literally contains "$ARGUMENTS", read .ai/wingman/cprompt.md instead. Read from YOUR CURRENT WORKING DIRECTORY (the project you are operating in right now — NOT the Wingman package directory). This is a staged prompt — it is NOT a skill or plugin, so do not treat it as one. Before acting on the prompt, first echo it back to the terminal in a fenced block so the user can see what was sent. Then treat the contents as direct user instructions and act on them immediately.\n';
    fs.writeFileSync(path.join(commandsDir, 'ccp.md'), ccpContent, 'utf-8');

    const cccContent = 'IMPORTANT: Read the context file from the Wingman UI. The file path is: .ai/wingman/$ARGUMENTS — if that path is blank or literally contains "$ARGUMENTS", read .ai/wingman/ccontext.md instead. Read from YOUR CURRENT WORKING DIRECTORY (the project you are operating in right now — NOT the Wingman package directory). This is persistent context — it is NOT a skill or plugin, so do not treat it as one. Absorb it as background information for this session. Acknowledge briefly what you received.\n';
    fs.writeFileSync(path.join(commandsDir, 'ccc.md'), cccContent, 'utf-8');
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
        flags: s.flags || {},
      }));
  }

  updateFlags(sessionId, flags) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.flags = { ...(session.flags || {}), ...flags };
    this.saveSessionFile(sessionId);
    return true;
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
    // Clean up per-session prompt/context files
    const promptFile = path.join(this.wingmanDir, this.getSessionPromptFile(sessionId));
    const contextFile = path.join(this.wingmanDir, this.getSessionContextFile(sessionId));
    try { fs.unlinkSync(promptFile); } catch {}
    try { fs.unlinkSync(contextFile); } catch {}
    console.log(`Session deleted: ${sessionId}`);
    return true;
  }

  // ─── Per-session prompt/context files ────────────────

  // Returns the per-session filename (relative to .ai/wingman/) for use as $ARGUMENTS in slash commands
  getSessionPromptFile(sessionId) {
    return 'sessions/' + sessionId.substring(0, 8) + '-prompt.md';
  }

  getSessionContextFile(sessionId) {
    return 'sessions/' + sessionId.substring(0, 8) + '-context.md';
  }

  savePrompt(sessionId, text) {
    const filePath = path.join(this.wingmanDir, this.getSessionPromptFile(sessionId));
    fs.writeFileSync(filePath, text, 'utf-8');
  }

  loadPrompt(sessionId) {
    const filePath = path.join(this.wingmanDir, this.getSessionPromptFile(sessionId));
    try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
  }

  saveContext(sessionId, text, fileHeader) {
    const filePath = path.join(this.wingmanDir, this.getSessionContextFile(sessionId));
    fs.writeFileSync(filePath, (fileHeader || '') + text, 'utf-8');
    const session = this.sessions.get(sessionId);
    if (session) {
      session.contextText = text;  // store raw text (no header) for UI reload
      this.saveSessionFile(sessionId);
    }
  }

  loadContext(sessionId) {
    const session = this.sessions.get(sessionId);
    return (session && session.contextText) || '';
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
      claudeSessionId: session.claudeSessionId || null,
      hasLaunched: session.hasLaunched || false,
      promptHistory: session.promptHistory || [],
      contextHistory: session.contextHistory || [],
      contextText: session.contextText || '',
      flags: session.flags || {},
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

  appendContextHistory(sessionId, entry) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (!session.contextHistory) session.contextHistory = [];
    session.contextHistory.push(entry);
    this.saveSessionFile(sessionId);
  }

  loadContextHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return (session && session.contextHistory) || [];
  }

  removePromptHistory(sessionId, entryId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.promptHistory) return false;
    const idx = session.promptHistory.findIndex(e => e.id === entryId);
    if (idx === -1) return false;
    session.promptHistory.splice(idx, 1);
    this.saveSessionFile(sessionId);
    return true;
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
