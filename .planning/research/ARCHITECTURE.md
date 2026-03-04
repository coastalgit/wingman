# Architecture Patterns

**Domain:** Browser-based terminal/process wrapper (Node.js server wrapping Claude Code CLI)
**Researched:** 2026-03-04
**Confidence:** HIGH (xterm.js + node-pty + WebSocket is the industry standard pattern, used by VS Code terminal, Theia, Gitpod, code-server, etc.)

## Recommended Architecture

```
Browser (per session window)              Node.js Server
+---------------------------+            +----------------------------------+
|  xterm.js Terminal Widget | <--WS----> | WebSocket Handler (per session)  |
|  + FitAddon               |            |   |                              |
|  + WebLinksAddon          |            |   v                              |
|  + SearchAddon            |            | Session Manager                  |
+---------------------------+            |   |                              |
                                         |   +-- Session Registry (Map)     |
Mission Control (launcher)               |   |     sessionId -> Session     |
+---------------------------+            |   |                              |
|  Session list + status    | <--WS----> |   +-- Session object             |
|  Create / kill sessions   |            |        |                         |
|  Wingman health display   |            |        +-- PTY Process (node-pty)|
+---------------------------+            |        +-- History Buffer (ring) |
                                         |        +-- Connected clients Set |
                                         +----------------------------------+
                                         |  HTTP Server (Express or Fastify)|
                                         |    Serves static UI files        |
                                         |    REST: /api/sessions (CRUD)    |
                                         +----------------------------------+
                                         |  Process Lifecycle Manager       |
                                         |    PID lock file                 |
                                         |    Cleanup on SIGINT/SIGTERM     |
                                         |    Stale PID detection           |
                                         +----------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **HTTP Server** | Serve static files, REST API for session CRUD, health check | Session Manager |
| **WebSocket Layer** | Bidirectional stream between browser and session; multiplexed by session ID | Session Manager, Browser |
| **Session Manager** | Create/destroy sessions, maintain registry, reconnection logic | PTY Process, WebSocket Layer, Process Lifecycle |
| **PTY Process** | Spawn Claude Code as child process via node-pty, handle stdin/stdout/stderr | Session Manager |
| **History Buffer** | Ring buffer per session storing output for reconnection replay | Session Manager |
| **Process Lifecycle Manager** | PID lock file, signal handling, cleanup of orphaned processes | Session Manager, OS |
| **Browser: xterm.js** | Terminal rendering, input capture, ANSI escape handling | WebSocket (to server) |
| **Browser: Mission Control** | Session launcher, status dashboard, Wingman controls | REST API + WebSocket |

### Data Flow

**Output flow (Claude Code -> Browser):**
```
Claude Code process
  -> PTY stdout (raw bytes including ANSI escapes)
    -> node-pty onData callback
      -> Append to History Buffer (ring buffer, capped at N bytes)
      -> For each connected WebSocket client:
          -> ws.send(data)  // binary or UTF-8 string
            -> xterm.js terminal.write(data)
              -> Rendered in browser
```

**Input flow (Browser -> Claude Code):**
```
User types in xterm.js
  -> terminal.onData callback
    -> ws.send(data)  // keystrokes as UTF-8
      -> WebSocket handler receives
        -> pty.write(data)  // piped to Claude Code stdin
```

**Resize flow (Browser -> Claude Code):**
```
Browser window resized
  -> FitAddon.fit() recalculates cols/rows
    -> terminal.onResize callback
      -> ws.send(JSON.stringify({type:'resize', cols, rows}))
        -> pty.resize(cols, rows)
```

**Reconnection flow:**
```
Browser tab reopened with sessionId
  -> WebSocket connects to /ws?sessionId=xxx
    -> Session Manager looks up session in registry
    -> If session alive:
        -> Replay History Buffer contents to new client
        -> Add client to session's connected clients Set
        -> Resume live streaming
    -> If session dead:
        -> Send terminal message: "Session ended"
```

## PTY vs Raw Pipe: Why PTY

**Use node-pty, not child_process.spawn.** This is a critical architectural decision.

| Concern | node-pty (PTY) | child_process (pipe) |
|---------|----------------|---------------------|
| ANSI color/formatting | Full support -- Claude Code outputs rich ANSI | Partial -- some programs disable colors when not a TTY |
| Interactive prompts | Works -- Claude Code thinks it is in a terminal | Broken -- many CLI tools detect non-TTY and change behavior |
| Line editing | Handled by PTY | Must implement manually |
| Window resize | `pty.resize(cols, rows)` | Not applicable |
| Ctrl+C / signals | Correct signal delivery via PTY | `process.kill()` only |
| Claude Code compatibility | Claude Code detects TTY and runs in full interactive mode | Claude Code may run in non-interactive/pipe mode, missing slash commands, confirmations, menus |

**Verdict:** PTY is required, not optional. Claude Code is a fully interactive terminal application. Without a PTY, it will likely detect non-interactive mode and degrade its UI (no colors, no interactive prompts, no tool confirmation dialogs). node-pty provides the pseudo-terminal that makes Claude Code behave exactly as it would in a real terminal.

**Platform note (Windows):** node-pty on Windows uses ConPTY (Windows 10 1809+). The developer's target is Windows 11, so this works natively. If Claude Code CLI runs in WSL, spawn via `wsl.exe -e claude` from the Windows-side node-pty -- the PTY still works across the WSL boundary.

## Patterns to Follow

### Pattern 1: Session-Scoped WebSocket Multiplexing

**What:** Each session gets a unique ID. WebSocket connections carry the session ID as a query parameter. The server routes messages to the correct PTY.

**When:** Always -- this is the core routing mechanism.

**Example:**
```typescript
// Server-side
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');
  const session = sessionManager.get(sessionId);

  if (!session) {
    ws.close(4004, 'Session not found');
    return;
  }

  // Replay history
  ws.send(session.historyBuffer.getContents());

  // Add to live listeners
  session.clients.add(ws);

  // Route input to PTY
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'input') {
      session.pty.write(msg.data);
    } else if (msg.type === 'resize') {
      session.pty.resize(msg.cols, msg.rows);
    }
  });

  ws.on('close', () => session.clients.delete(ws));
});

// PTY output -> broadcast to all connected clients
session.pty.onData((data) => {
  session.historyBuffer.append(data);
  for (const client of session.clients) {
    client.send(JSON.stringify({ type: 'output', data }));
  }
});
```

### Pattern 2: Ring Buffer for History Replay

**What:** Server maintains a fixed-size circular buffer (e.g., 1MB) per session storing raw PTY output. On reconnection, replay the buffer to the new client.

**When:** Session reconnection -- browser tab closed and reopened.

**Why ring buffer:** Unbounded history = memory leak. A 1MB ring buffer holds roughly 500K-1M characters of terminal output, which is more than enough for scrollback. Old content is silently discarded.

**Example:**
```typescript
class RingBuffer {
  private buffer: Buffer;
  private writePos = 0;
  private full = false;

  constructor(private maxSize: number = 1024 * 1024) {
    this.buffer = Buffer.alloc(maxSize);
  }

  append(data: string | Buffer): void {
    const bytes = Buffer.from(data);
    if (bytes.length >= this.maxSize) {
      bytes.copy(this.buffer, 0, bytes.length - this.maxSize);
      this.writePos = 0;
      this.full = true;
      return;
    }
    // ... wrap-around write logic
  }

  getContents(): Buffer {
    if (!this.full) return this.buffer.slice(0, this.writePos);
    return Buffer.concat([
      this.buffer.slice(this.writePos),
      this.buffer.slice(0, this.writePos)
    ]);
  }
}
```

### Pattern 3: Protocol Envelope

**What:** WebSocket messages use a simple JSON envelope with `type` field to distinguish input, output, resize, and control messages.

**When:** All WebSocket communication.

```typescript
// Browser -> Server
{ type: 'input', data: 'hello\r' }
{ type: 'resize', cols: 120, rows: 40 }

// Server -> Browser
{ type: 'output', data: '\x1b[32mClaude>\x1b[0m ...' }
{ type: 'session-ended', exitCode: 0 }
{ type: 'history-replay-start' }
{ type: 'history-replay-end' }
```

**Note on binary vs JSON:** For maximum throughput, some implementations send PTY output as raw binary WebSocket frames (avoiding JSON serialization overhead). For Wingman's use case (human-speed terminal interaction), JSON envelopes are simpler and the overhead is negligible.

### Pattern 4: Mission Control as Separate Page, Not Tab

**What:** Mission Control is a distinct HTML page at `/` that lists sessions. Each session opens in its own browser window/tab at `/session?id=xxx`.

**When:** Multi-session management.

**Rationale:** Each session needs its own xterm.js instance with independent scroll, resize, and focus. Embedding multiple terminals in tabs within one page adds complexity (inactive tabs don't resize correctly, focus management becomes painful). Separate windows map naturally to the "one terminal per task" mental model.

```
GET /                    -> Mission Control (session launcher)
GET /session?id=xxx      -> Session terminal (xterm.js)
GET /api/sessions        -> REST: list sessions
POST /api/sessions       -> REST: create session
DELETE /api/sessions/:id -> REST: kill session
WS /ws?sessionId=xxx     -> WebSocket: terminal stream
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Polling Instead of WebSocket
**What:** Using HTTP polling or Server-Sent Events for terminal output.
**Why bad:** Terminal output is bidirectional and bursty. Polling adds latency. SSE is unidirectional (can't send input back). WebSocket is the only sensible choice for interactive terminal streaming.
**Instead:** WebSocket for all terminal I/O.

### Anti-Pattern 2: Storing Full Session History Unbounded
**What:** Appending all PTY output to an ever-growing array or string.
**Why bad:** A busy Claude Code session can produce megabytes of output. Without bounds, memory grows linearly with session duration.
**Instead:** Ring buffer with fixed size. For persistent history, write to disk asynchronously (log file), not in-memory.

### Anti-Pattern 3: One WebSocket Per Concern
**What:** Separate WebSocket connections for input, output, resize, and control.
**Why bad:** Ordering guarantees are lost across connections. Connection management becomes complex.
**Instead:** Single WebSocket per session, multiplexed by message type via JSON envelope.

### Anti-Pattern 4: Raw child_process.spawn Without PTY
**What:** Spawning Claude Code with `child_process.spawn()` and piping stdin/stdout.
**Why bad:** Claude Code detects non-TTY and may disable interactive features (colors, confirmations, slash command menus). No resize support. Signal handling is different.
**Instead:** Always use node-pty for interactive CLI wrapping.

### Anti-Pattern 5: xterm.js in Mission Control
**What:** Embedding terminal instances directly in the Mission Control launcher page.
**Why bad:** Multiple xterm.js instances on one page fight for focus, don't resize properly when hidden, and increase memory usage. Mission Control should be a lightweight status dashboard.
**Instead:** Mission Control shows session metadata (name, status, uptime). Clicking a session opens it in a new window.

## Suggested Build Order (PoC-First)

### Phase 1: Minimal Viable Pipe (PoC)
Goal: Validate browser <-> Claude Code works at all.

Components built:
1. HTTP server serving a single static HTML page with xterm.js
2. Single WebSocket endpoint
3. node-pty spawning a single Claude Code process
4. Wire: xterm.js <-> WebSocket <-> node-pty

**No session management, no history, no Mission Control.** Just one hardcoded terminal in one browser tab. If this works, everything else is layering.

Validates: PTY works with Claude Code on Windows/WSL, xterm.js renders output correctly, input flows back, ANSI escapes render properly.

### Phase 2: Session Management
Add:
- Session Manager with create/destroy
- Session registry (in-memory Map)
- REST API for session CRUD
- WebSocket routing by session ID
- History ring buffer per session
- Reconnection replay

### Phase 3: Mission Control
Add:
- Mission Control page at `/`
- Session list with status indicators
- Create/kill session controls
- Each session opens in own window

### Phase 4: Process Lifecycle
Add:
- PID lock file (prevent duplicate Wingman instances)
- Signal handling (SIGINT, SIGTERM cleanup)
- Stale PID detection on startup
- Graceful shutdown (kill all child PTYs)
- Session persistence to disk (survive server restart -- optional)

### Phase 5: Polish
Add:
- xterm.js addons (fit, search, web links)
- Session metadata display in terminal window
- `--manual` mode flag
- Window title updates
- Error handling and edge cases

**Phase ordering rationale:** Phase 1 is a spike that validates the core technical risk (can we wrap Claude Code in a PTY and stream it to a browser?). If that fails, nothing else matters. Phase 2 adds the server-side brain. Phase 3 adds the user-facing launcher. Phase 4 adds production robustness. Phase 5 is refinement.

## Key Technology Choices

| Component | Technology | Why |
|-----------|-----------|-----|
| PTY | node-pty | Only mature Node.js PTY library. Used by VS Code. ConPTY support on Windows. |
| Terminal UI | xterm.js | Industry standard browser terminal. Used by VS Code web, Theia, Gitpod, code-server. |
| WebSocket | ws | Fastest, most used Node.js WebSocket library. No framework overhead. |
| HTTP Server | Express (or plain http) | Simple static file serving + REST API. Fastify is faster but Express is more familiar and fine for local-only use. |
| History | Custom ring buffer | Simple, bounded, no external dependency needed. |

## Scalability Considerations

| Concern | 1 session (PoC) | 5-10 sessions (typical) | 50+ sessions (unlikely) |
|---------|-----------------|-------------------------|------------------------|
| Memory | ~20MB (node-pty + xterm buffer) | ~100-200MB | Would need history buffer tuning, but this is a local dev tool so irrelevant |
| CPU | Negligible -- just piping bytes | Negligible | Still negligible -- bottleneck is Claude API, not local I/O |
| WebSocket connections | 1 | 5-10 | ws library handles thousands; not a concern |
| Port usage | 1 port for everything | Same | Same |

**This is a local development tool for a single developer. Scalability beyond ~10 concurrent sessions is not a real concern.** The architecture should optimize for simplicity and correctness, not throughput.

## Platform-Specific Notes (Windows + WSL)

Claude Code CLI typically runs inside WSL. Wingman's Node.js server runs on Windows natively. Two approaches:

1. **Spawn via WSL bridge (recommended):** `node-pty` spawns `wsl.exe -e claude` (or `wsl.exe -e bash -c "claude"` if path setup is needed). The PTY wraps the Windows-side process; WSL handles the rest transparently. This is how VS Code's integrated terminal runs WSL commands.

2. **Run Wingman server inside WSL:** Run `npx wingman` from within WSL. Then node-pty spawns `claude` directly. Browser connects to `localhost:PORT` which WSL forwards automatically. Simpler PTY behavior but requires Node.js installed in WSL.

**Recommendation:** Start with approach 1 (Windows-native server, WSL bridge spawn) since that matches the developer's current workflow. Fall back to approach 2 if PTY issues arise.

## Sources

- xterm.js documentation (xtermjs.org) -- industry standard browser terminal emulator
- node-pty (github.com/microsoft/node-pty) -- Microsoft's PTY binding for Node.js, used by VS Code
- ws (github.com/websockets/ws) -- de facto Node.js WebSocket library
- VS Code terminal architecture -- same pattern (node-pty on backend, xterm.js on frontend, message passing between)
- code-server (github.com/coder/code-server) -- VS Code in browser, uses identical xterm.js + node-pty + WebSocket architecture
- Theia IDE -- another browser IDE using this exact stack
- Confidence: HIGH -- this is a mature, well-proven architecture pattern used by all major browser-based terminal implementations
