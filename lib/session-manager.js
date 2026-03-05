// SessionManager: Tracks active PTY sessions by UUID, stores terminal history for reconnect,
// persists metadata to .ai/wingman/sessions.json
//
// Lifecycle: new SessionManager() on server startup -> spawnSession(ptyProcess) per WebSocket connection
// -> addToHistory(sessionId, data) on each PTY output -> closeSession(sessionId) on PTY exit/SIGINT
//
// File structure: .ai/wingman/sessions.json contains [{ id, createdAt, closed }]
// (ptyProcess is in-memory only; history is ephemeral per server instance)

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SessionManager {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.sessionsDir = path.join(projectRoot, '.ai', 'wingman');
    this.sessionsFile = path.join(this.sessionsDir, 'sessions.json');

    // In-memory tracking: sessionId -> { id, createdAt, ptyProcess, history[], closed }
    this.sessions = new Map();

    // Circular buffer: keep last 10,000 lines for reconnect replay to prevent unbounded memory growth
    this.historyLimit = 10000;

    // Ensure .ai/wingman directory exists
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }

    // Load existing sessions from disk on startup
    this.loadSessionsFromDisk();
  }

  // Generate unique session ID using UUID v4
  generateSessionId() {
    return crypto.randomUUID();
  }

  // Register a new session. ptyProcess is wired separately via spawnAndWirePty in server.js.
  spawnSession(ptyProcess = null, metadata = {}) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      ptyProcess,
      history: [],
      closed: false,
      primaryWs: null,
      ...metadata,
    };
    this.sessions.set(sessionId, session);
    this.updateSessionsFile();
    console.log(`Session created: ${sessionId}`);
    return sessionId;
  }

  // Retrieve session by ID (for reconnect, input routing, etc.)
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // Append terminal output to session history (circular buffer)
  addToHistory(sessionId, data) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.history.push(data);
      // Trim to historyLimit to prevent unbounded growth
      if (session.history.length > this.historyLimit) {
        session.history.shift();
      }
    }
  }

  // Get buffered history for a session (used on reconnect to replay)
  getHistory(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.history : [];
  }

  // Derive session status from in-memory state
  getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return 'closed';
    if (!session.closed && session.ptyProcess) return 'active';
    if (!session.closed && !session.ptyProcess) return 'reconnectable';
    return 'closed';
  }

  // Return all sessions with derived status for Mission Control dashboard
  getAllSessionsWithStatus() {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      description: s.description || 'Session ' + s.id.substring(0, 8),
      createdAt: s.createdAt,
      status: this.getSessionStatus(s.id),
    }));
  }

  // Mark session as explicitly closed by user — permanent, won't be reconnectable
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.closed = true;
      session.ptyProcess = null;
      this.updateSessionsFile();
      console.log(`Session closed: ${sessionId}`);
    }
  }

  // PTY process died but session is NOT explicitly closed — stays reconnectable
  // Used when PTY exits naturally (user types 'exit') or on server shutdown
  detachPty(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ptyProcess = null;
      // Do NOT set closed = true — session remains reconnectable
      this.updateSessionsFile();
      console.log(`Session PTY detached: ${sessionId}`);
    }
  }

  // Write metadata to disk (atomic): ptyProcess is memory-only and not persisted
  updateSessionsFile() {
    const metadata = Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      description: s.description || null,
      createdAt: s.createdAt,
      closed: s.closed,
    }));

    // Write to temp file first, then atomically rename to prevent corruption on crash
    const tmpFile = this.sessionsFile + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(metadata, null, 2));
    fs.renameSync(tmpFile, this.sessionsFile);
  }

  // Load sessions from disk on startup (restore closed session list and metadata)
  loadSessionsFromDisk() {
    if (fs.existsSync(this.sessionsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
        // Restore metadata only; PTY processes are spawned fresh; history is ephemeral
        data.forEach(s => {
          if (!this.sessions.has(s.id)) {
            this.sessions.set(s.id, {
              ...s,
              ptyProcess: null,
              history: [],
            });
          }
        });
      } catch (err) {
        console.error('Failed to load sessions.json:', err);
      }
    }
  }
}

module.exports = SessionManager;
