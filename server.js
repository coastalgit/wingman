// server.js
// node-pty: using node-pty (native build succeeded on Node 20 / Windows)
//
// ConPTY spike result (01-02 Task 1):
//   Git Bash spawns cleanly via node-pty + ConPTY. Output is clean (no garbled binary).
//   useConpty: false is NOT needed.
//
// Claude binary:
//   Native installer binary at ~/.local/bin/claude.exe (v2.1.68).
//   The native binary works correctly with node-pty + ConPTY on this system.
//   No npm version present; native binary is used directly via `bash -c 'claude'`.

const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
let pty;
try {
  pty = require('node-pty');
} catch {
  console.error('node-pty is not installed. Run: npm install node-pty');
  console.error('(Requires C++ build tools on Windows — see README.)');
  process.exit(1);
}
const SessionManager = require('./lib/session-manager.js');
const { acquireLock, releaseLock } = require('./lib/process-lock.js');
const { initManualMode } = require('./lib/manual-mode.js');

// Port: --port CLI arg > PORT env var > 0 (OS auto-assigns a free port)
// Using 0 means multiple Wingman instances in different directories never conflict.
const portArg = (() => {
  const i = process.argv.indexOf('--port');
  return i !== -1 ? parseInt(process.argv[i + 1], 10) : null;
})();
const PORT = portArg || parseInt(process.env.PORT, 10) || 0;

const lockPath = path.join(process.cwd(), '.ai', 'wingman', 'wingman.pid');
const MANUAL_MODE = process.argv.includes('--manual');

// Git Bash path detection — checks common Windows install locations.
// Override with WINGMAN_BASH_PATH env var if your installation is non-standard.
const fs = require('fs');

function findGitBash() {
  const pf   = process.env.PROGRAMFILES        || 'C:\\Program Files';
  const pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA        || '';

  const candidates = [
    process.env.WINGMAN_BASH_PATH,
    path.join(pf,   'Git', 'bin', 'bash.exe'),
    path.join(pf86, 'Git', 'bin', 'bash.exe'),
    local && path.join(local, 'Programs', 'Git', 'bin', 'bash.exe'),
  ].filter(Boolean);

  return candidates.find(p => fs.existsSync(p)) || null;
}

const BASH_PATH = findGitBash();

if (!BASH_PATH) {
  console.error('Git Bash not found. Please install Git for Windows: https://git-scm.com/download/win');
  console.error('Or set the WINGMAN_BASH_PATH environment variable to your bash.exe path.');
  process.exit(1);
}

const app = express();

// JSON body parsing for POST endpoints (10MB limit for file uploads)
app.use(express.json({ limit: '10mb' }));

// --- Custom routes (BEFORE express.static to avoid index.html interception) ---

// Mission Control dashboard at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mission-control.html'));
});

// Session terminal page (UUID pattern only — prevents catching static file requests)
app.get('/session/:id([0-9a-f-]{36})', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'session.html'));
});

// REST API: Server mode (normal vs manual)
app.get('/api/mode', (req, res) => {
  res.json({ manual: MANUAL_MODE });
});

// REST API: App version (from package.json)
app.get('/api/version', (req, res) => {
  const pkg = require('./package.json');
  res.json({ version: pkg.version, build: pkg.build || 0 });
});

// REST API: Project info (basename of cwd)
app.get('/api/project-info', (req, res) => {
  res.json({ name: path.basename(process.cwd()) });
});

// REST API: List all sessions with status
app.get('/api/sessions', (req, res) => {
  res.json(sessionManager.getAllSessionsWithStatus());
});

// REST API: Create a new session (spawns PTY)
app.post('/api/sessions', (req, res) => {
  if (MANUAL_MODE) {
    return res.status(400).json({ error: 'Manual mode active — no Claude sessions spawned', manual: true });
  }

  const description = (req.body && req.body.description) || 'Claude Code session';

  // Register session metadata first (with no PTY yet), then spawn
  const sessionId = sessionManager.spawnSession(null, { description });
  spawnAndWirePty(sessionId);
  broadcastSessionUpdate();

  res.json({ sessionId, url: '/session/' + sessionId });
});

// REST API: Stop a session — kills the PTY but keeps the session restartable
app.delete('/api/sessions/:id', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.ptyProcess) {
    session.ptyProcess.kill();
  }
  sessionManager.detachPty(req.params.id);
  broadcastSessionUpdate();
  res.json({ status: 'stopped', sessionId: req.params.id });
});

// REST API: Permanently delete a stopped session (removes from registry and deletes file)
app.delete('/api/sessions/:id/delete', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.ptyProcess) return res.status(400).json({ error: 'Session is active — stop it first' });
  sessionManager.deleteSession(req.params.id);
  broadcastSessionUpdate();
  res.json({ status: 'deleted', sessionId: req.params.id });
});

// REST API: Get current prompt (shared file)
app.get('/api/sessions/:id/prompt', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ text: sessionManager.loadPrompt() });
});

// REST API: Send prompt — write directly to Claude's stdin (no /ccp slash command)
app.post('/api/sessions/:id/prompt', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const text = (req.body && req.body.text) || '';
  sessionManager.savePrompt(text);

  const entry = {
    id: Date.now().toString(),
    text,
    timestamp: new Date().toISOString(),
    tokens: Math.ceil(text.length / 4),
  };
  sessionManager.appendPromptHistory(req.params.id, entry);

  if (session.ptyProcess) {
    const suppressEcho = !!(req.body && req.body.suppressEcho);

    // Echo the prompt into the terminal (unless suppressed)
    if (!suppressEcho && text) {
      const maxPreview = 2000;
      const preview = text.length > maxPreview ? text.substring(0, maxPreview) + '\n... [truncated]' : text;
      const echoLines = preview.split('\n').map(l => '  ' + l).join('\r\n');
      const echo = '\r\n\x1b[38;5;245m\x1b[3m── prompt sent ──────────────────────────\x1b[0m\r\n'
                 + '\x1b[38;5;245m' + echoLines + '\x1b[0m\r\n'
                 + '\x1b[38;5;245m\x1b[3m─────────────────────────────────────────\x1b[0m\r\n';
      wss.clients.forEach((client) => {
        if (client.readyState === 1 && client.sessionId === req.params.id) {
          client.send(JSON.stringify({ type: 'output', data: echo }));
        }
      });
      sessionManager.addToHistory(req.params.id, echo);
    }

    // Escape any current state (thinking, waiting, tool confirmation), then send /ccp.
    // Escape cancels pending operations; Ctrl+U clears the input line; short delay
    // ensures Claude returns to its input prompt before we type /ccp.
    session.ptyProcess.write('\x1b');
    setTimeout(() => {
      if (session.ptyProcess) {
        session.ptyProcess.write('\x15/ccp\r');
      }
    }, 300);
  }

  res.json({ status: 'sent', entry });
});

// REST API: Get current context (shared file)
app.get('/api/sessions/:id/context', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ text: sessionManager.loadContext(req.params.id) });
});

// REST API: Send context — save to shared file + per-session, inject /ccc into PTY, append to history
app.post('/api/sessions/:id/context', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const text = (req.body && req.body.text) || '';
  sessionManager.saveContext(req.params.id, text);

  const entry = {
    id: Date.now().toString(),
    text,
    timestamp: new Date().toISOString(),
    tokens: Math.ceil(text.length / 4),
  };
  sessionManager.appendContextHistory(req.params.id, entry);

  if (session.ptyProcess) {
    session.ptyProcess.write('\x15/ccc\r');
  }

  res.json({ status: 'sent', entry });
});

// REST API: Get context history for a session
app.get('/api/sessions/:id/context/history', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(sessionManager.loadContextHistory(req.params.id));
});

// REST API: Get prompt history for a session
app.get('/api/sessions/:id/history', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(sessionManager.loadPromptHistory(req.params.id));
});

// REST API: Update session flags (yolo, withChrome, etc.)
app.patch('/api/sessions/:id/flags', (req, res) => {
  const session = sessionManager.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const flags = (req.body && typeof req.body === 'object') ? req.body : {};
  sessionManager.updateFlags(req.params.id, flags);
  broadcastSessionUpdate();
  res.json({ status: 'ok', flags: session.flags });
});

// REST API: Get config (templates, settings)
app.get('/api/config', (req, res) => {
  res.json(sessionManager.loadConfig());
});

// REST API: Update settings
app.patch('/api/settings', (req, res) => {
  const updates = (req.body && typeof req.body === 'object') ? req.body : {};
  const config = sessionManager.loadConfig();
  config.settings = { ...(config.settings || {}), ...updates };
  sessionManager.saveConfig(config);
  res.json({ status: 'ok', settings: config.settings });
});

// REST API: Parsed claude CLI flags (for args editor)
let cachedClaudeFlags = null;

function parseClaudeFlags(helpText) {
  const flags = [];
  const lines = helpText.split('\n');
  let inOptions = false;
  const skip = new Set([
    '--help', '--version', '--print', '--output-format', '--input-format',
    '--json-schema', '--max-budget-usd', '--include-partial-messages',
    '--replay-user-messages', '--file', '--fallback-model', '--no-session-persistence',
    '--session-id', '--from-pr', '--strict-mcp-config', '--tmux',
    '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions',
    '--chrome', '--no-chrome', '--enable-auto-mode',
    '--resume', '--continue', '--fork-session', '--name',
  ]);

  for (const line of lines) {
    if (line.trim() === 'Options:') { inOptions = true; continue; }
    if (/^Commands:/.test(line.trim())) break;
    if (!inOptions || !/^\s{2,}-/.test(line)) continue;

    const m = line.match(/^\s+(?:(-\w),\s+)?(--[\w-]+)(?:,\s+--[\w-]+)?(?:\s+(<[^>]+>|\[[^\]]+\]))?\s{2,}(.+)/);
    if (!m) continue;

    const long = m[2];
    if (skip.has(long)) continue;

    const short = m[1] || undefined;
    const valueRaw = m[3] || undefined;
    const value = valueRaw ? valueRaw.replace(/[<>\[\]]/g, '') : undefined;
    const desc = m[4].trim();

    let choices;
    const cm = desc.match(/\(choices:\s*([^)]+)\)/);
    if (cm) choices = cm[1].split(',').map(c => c.trim().replace(/"/g, ''));

    flags.push({ long, short, value, choices, desc });
  }
  return flags;
}

app.get('/api/claude-flags', (req, res) => {
  if (cachedClaudeFlags) return res.json(cachedClaudeFlags);
  try {
    // Use execFileSync to avoid cmd.exe shell wrapper on Windows
    const helpText = require('child_process').execFileSync(BASH_PATH, ['-c', 'claude --help'], { encoding: 'utf8', timeout: 10000 });
    cachedClaudeFlags = parseClaudeFlags(helpText);
    res.json(cachedClaudeFlags);
  } catch (err) {
    console.error('Failed to parse claude --help:', err.message);
    res.json([]);
  }
});

// REST API: List files in a directory (for file browser)
app.get('/api/files', (req, res) => {
  const relPath = req.query.path || '.';
  const absPath = path.resolve(process.cwd(), relPath);
  const cwd = process.cwd().replace(/\\/g, '/');
  const abs = absPath.replace(/\\/g, '/');

  if (!abs.startsWith(cwd)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    const items = entries
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        path: path.relative(process.cwd(), path.join(absPath, e.name)).replace(/\\/g, '/'),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    res.json({ path: path.relative(process.cwd(), absPath).replace(/\\/g, '/') || '.', items });
  } catch (err) {
    res.status(404).json({ error: 'Directory not found' });
  }
});

// REST API: Upload a file to the project (saves to defaultFileDir)
app.post('/api/files/upload', (req, res) => {
  const { name, data } = req.body || {};
  if (!name || !data) return res.status(400).json({ error: 'name and data (base64) required' });

  // Sanitise filename — strip path separators
  const safeName = path.basename(name).replace(/[<>:"|?*]/g, '_');
  if (!safeName) return res.status(400).json({ error: 'Invalid filename' });

  const config = sessionManager.loadConfig();
  const destDir = (config.settings && config.settings.defaultFileDir) || 'docs/promptfiles';
  const absDir = path.resolve(process.cwd(), destDir);

  // Security: ensure within project
  if (!absDir.replace(/\\/g, '/').startsWith(process.cwd().replace(/\\/g, '/'))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  fs.mkdirSync(absDir, { recursive: true });
  const destPath = path.join(absDir, safeName);
  fs.writeFileSync(destPath, Buffer.from(data, 'base64'));

  const relPath = path.relative(process.cwd(), destPath).replace(/\\/g, '/');
  res.json({ path: relPath, name: safeName });
});

// REST API: Shutdown Wingman
app.post('/api/shutdown', (req, res) => {
  res.json({ status: 'shutting-down' });
  gracefulShutdown();
});

// Static files AFTER custom routes (avoids index.html interception)
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Initialize SessionManager (singleton) on server startup
const sessionManager = new SessionManager(process.cwd());

// Manual mode: create prompt/context files, skip PTY spawning
if (MANUAL_MODE) {
  const { promptPath, contextPath } = initManualMode(sessionManager.sessionsDir);
  console.log('Wingman started in manual mode. Session files:');
  console.log('  Prompt:  ' + promptPath);
  console.log('  Context: ' + contextPath);
}

// Broadcast session list update to all Mission Control clients
function broadcastSessionUpdate() {
  const sessions = sessionManager.getAllSessionsWithStatus();
  const msg = JSON.stringify({ type: 'session-update', sessions });
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && client.clientType === 'mc') {
      client.send(msg);
    }
  });
}

// Spawn a PTY and wire up onData/onExit for a session that already exists in SessionManager.
// Used both for new sessions (POST /api/sessions) and reconnecting to reconnectable sessions.
function buildClaudeCommand(session, isResume) {
  const parts = ['claude'];

  // Resume with Claude's own session ID if available
  if (isResume && session.claudeSessionId) {
    parts.push('--resume', session.claudeSessionId);
  } else if (session.claudeSessionId) {
    // First launch — assign a known session ID so we can resume later
    parts.push('--session-id', session.claudeSessionId);
  }

  if (session.flags) {
    if (session.flags.yolo) parts.push('--dangerously-skip-permissions');
    if (session.flags.autoMode) parts.push('--enable-auto-mode');
    if (session.flags.withChrome) parts.push('--chrome');
    const args = session.flags.customArgs;
    if (args && typeof args === 'object') {
      for (const [flag, val] of Object.entries(args)) {
        if (val === true) parts.push(flag);
        else if (typeof val === 'string' && val.trim()) {
          parts.push(flag, "'" + val.replace(/'/g, "'\\''") + "'");
        }
      }
    }
  }
  return parts.join(' ');
}

function spawnAndWirePty(sessionId) {
  const session = sessionManager.getSession(sessionId);
  const isResume = !!(session.claudeSessionId && session.hasLaunched);

  // Assign a Claude session ID on first launch (so we can --resume later)
  if (!session.claudeSessionId) {
    session.claudeSessionId = crypto.randomUUID();
    sessionManager.saveSessionFile(sessionId);
  }

  const cmd = buildClaudeCommand(session, isResume);
  console.log(`Session ${sessionId}: spawning${isResume ? ' (resume)' : ''}: ${cmd}`);

  const ptyProcess = pty.spawn(BASH_PATH, ['-c', cmd], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

  // Wire the new PTY into the existing session object
  session.ptyProcess = ptyProcess;
  session.closed = false;
  session.hasLaunched = true;
  session.primaryWs = null; // reset primary on new PTY
  sessionManager.updateSessionsFile();

  // Buffer PTY output into history and broadcast to all connected terminal clients
  ptyProcess.onData((data) => {
    sessionManager.addToHistory(sessionId, data);
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.sessionId === sessionId) {
        client.send(JSON.stringify({ type: 'output', data }));
      }
    });
  });

  // PTY exited naturally (e.g. user typed 'exit') — detach but keep session reconnectable
  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Session ${sessionId}: PTY exited (code=${exitCode}, signal=${signal})`);
    sessionManager.detachPty(sessionId);
    broadcastSessionUpdate();
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && client.sessionId === sessionId) {
        client.send(JSON.stringify({ type: 'session-ended', sessionId }));
      }
    });
  });

  return ptyProcess;
}

// Graceful shutdown: broadcast, kill PTYs (leave sessions reconnectable), release lock, close server
let shuttingDown = false;
function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nShutting down...');

  // Broadcast shutdown to all WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'shutdown' }));
    }
  });

  // Kill active PTY processes — use detachPty so sessions remain reconnectable on next start
  sessionManager.sessions.forEach((session, sessionId) => {
    if (session.ptyProcess) {
      session.ptyProcess.kill();
      sessionManager.detachPty(sessionId);
    }
  });

  // Release PID lock
  releaseLock(lockPath);

  // Terminate all WebSocket connections and stop accepting new HTTP connections
  wss.clients.forEach((ws) => ws.terminate());
  server.close();
  // Force exit after brief delay — node-pty cleanup can keep the event loop alive
  setTimeout(() => process.exit(0), 300);
}

wss.on('connection', (ws) => {
  let sessionId = null;

  ws.on('message', (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      // Mission Control client identification
      if (msg.type === 'mc-connect') {
        ws.clientType = 'mc';
        ws.send(JSON.stringify({
          type: 'session-update',
          sessions: sessionManager.getAllSessionsWithStatus(),
        }));
        return;
      }

      // Handshake: client connects to an existing session
      if (msg.type === 'handshake') {
        sessionId = msg.sessionId || null;

        if (sessionId && sessionManager.getSession(sessionId)) {
          const session = sessionManager.getSession(sessionId);

          // If reconnectable (PTY dead, not explicitly closed), spawn a fresh Claude process
          if (!session.ptyProcess && !session.closed) {
            console.log(`Session ${sessionId}: reconnecting — spawning new PTY`);
            spawnAndWirePty(sessionId);
            broadcastSessionUpdate();
          }

          // Tag this WebSocket for PTY output broadcasting
          ws.sessionId = sessionId;

          // First client to connect to this session controls PTY resize
          if (!session.primaryWs) {
            session.primaryWs = ws;
            ws.isPrimary = true;
          }

          // Always replay full history — xterm.js processes all escape sequences in order
          // and arrives at the correct terminal state. This gives every tab the same view.
          const history = sessionManager.getHistory(sessionId);
          const status = history.length > 0 ? 'resumed' : 'new';

          console.log(`Client connected to session ${sessionId} (status: ${status}, primary: ${ws.isPrimary || false})`);
          ws.send(JSON.stringify({
            type: 'handshake-ack',
            sessionId,
            status,
            description: session.description || 'Claude Code session',
            createdAt: session.createdAt,
            history,
            yolo: !!(session.flags && session.flags.yolo),
            autoMode: !!(session.flags && session.flags.autoMode),
            withChrome: !!(session.flags && session.flags.withChrome),
            projectName: path.basename(process.cwd()),
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown session. Launch from Mission Control.',
          }));
        }
      }

      // Input: route to active session's PTY
      if (msg.type === 'input') {
        const session = sessionManager.getSession(sessionId);
        if (session && session.ptyProcess) {
          session.ptyProcess.write(msg.data);
        }
      }

      // Resize: only the primary client controls PTY dimensions
      // This prevents multiple tabs from fighting over the terminal size
      if (msg.type === 'resize' && ws.isPrimary) {
        const session = sessionManager.getSession(sessionId);
        if (session && session.ptyProcess) {
          session.ptyProcess.resize(msg.cols, msg.rows);
        }
      }
    } catch (e) {
      console.error('Bad message:', e);
    }
  });

  ws.on('close', () => {
    // If primary client disconnected, clear so next connection can take over
    if (ws.isPrimary && sessionId) {
      const session = sessionManager.getSession(sessionId);
      if (session && session.primaryWs === ws) {
        session.primaryWs = null;
      }
    }
    // Broadcast to MC so session list stays current (e.g. after /exit or tab close)
    if (sessionId) {
      broadcastSessionUpdate();
    }
    console.log('Client disconnected');
  });

  ws.on('error', (err) => console.error('WebSocket error:', err));
});

server.listen(PORT, () => {
  const actualPort = server.address().port;

  // Acquire PID lock now that we know the actual port (PORT may have been 0)
  acquireLock(lockPath, actualPort);

  const modeLabel = MANUAL_MODE ? 'Wingman (manual mode)' : 'Wingman';
  console.log(`${modeLabel} running at http://localhost:${actualPort}`);
  import('open').then(({ default: open }) => open(`http://localhost:${actualPort}`));
});

process.on('SIGINT', () => gracefulShutdown());

// Safety net: release lock on any exit (sync-only, no async work)
process.on('exit', () => releaseLock(lockPath));

// Prevent PID file from persisting on uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown();
});
