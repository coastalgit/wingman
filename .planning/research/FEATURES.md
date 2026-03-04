# Feature Landscape

**Domain:** Browser-based terminal wrapper for AI coding assistant (Claude Code CLI)
**Researched:** 2026-03-04
**Confidence:** MEDIUM (training data only -- WebSearch and WebFetch unavailable; findings based on extensive knowledge of xterm.js, ttyd, Wetty, Warp, VS Code terminal, Cursor, Aider, Continue.dev, GitHub Codespaces)

## Table Stakes

Features users expect from a browser-based terminal wrapper for an AI coding tool. Missing any of these and the product feels broken or pointless -- users will just use the raw terminal instead.

| Feature | Why Expected | Complexity | PoC vs Full | Notes |
|---------|--------------|------------|-------------|-------|
| Real terminal emulation (xterm.js) | Users expect full ANSI color, cursor positioning, scrollback -- Claude Code uses rich terminal output (spinners, colors, tool use boxes) | Med | PoC | xterm.js is the only serious option; used by VS Code, Hyper, Codespaces |
| Bidirectional I/O streaming | Must be able to type input AND see output in real time; Claude Code is interactive (confirmations, slash commands) | Med | PoC | WebSocket-based; node-pty on server side spawns the PTY |
| Full scrollback buffer | AI sessions produce long output; users scroll back to review what was generated | Low | PoC | xterm.js handles this natively; just configure buffer size |
| Copy/paste support | Terminal copy/paste is table stakes; users copy generated code constantly | Low | PoC | xterm.js supports this; may need clipboard API permissions |
| Session persistence across tab close | Closing browser tab must NOT kill the Claude process; reopening reconnects with full history | High | Full build | Server buffers terminal output; reconnect replays buffer. This is THE key differentiator over raw terminal |
| Responsive/resizable terminal | Window resize must propagate to PTY (SIGWINCH) so Claude Code reflows output correctly | Med | PoC | xterm.js fit addon + node-pty resize. Common pitfall if skipped |
| Keyboard shortcut passthrough | Ctrl+C, Ctrl+D, arrow keys, tab completion must work exactly as in a real terminal | Low | PoC | xterm.js handles this if wired correctly to PTY stdin |
| Session list / sidebar | Users need to see and switch between sessions; single-session is too limiting for daily use | Med | Full build | The testbed already has this UI pattern |
| New session creation | Users need to spawn new Claude Code processes on demand | Med | Full build | Each session = new node-pty + new xterm.js instance |
| Clean process lifecycle | Starting/stopping sessions must cleanly spawn/kill child processes; no orphan processes | Med | Full build | SIGTERM on close, SIGKILL fallback, PID tracking |
| Connection status indicator | User must know if WebSocket is connected, reconnecting, or dead | Low | PoC | Simple dot indicator; already in testbed header |
| Basic error handling | Process crash, WebSocket disconnect, server restart -- user sees clear error, not a blank screen | Med | PoC | Error overlay with reconnect option |

## Differentiators

Features that make Wingman genuinely better than just using Claude Code in a terminal. These are where the product earns its existence.

| Feature | Value Proposition | Complexity | PoC vs Full | Notes |
|---------|-------------------|------------|-------------|-------|
| Slash command autocomplete menu | Claude Code has slash commands (/help, /compact, /clear, etc.) -- surface them as a dropdown autocomplete when user types "/" | Med | Full build | Parse known command list; display as floating menu above input. Warp-style command palette UX |
| Tool use approval buttons | Claude Code asks "Allow tool X?" -- render as clickable Accept/Reject buttons instead of typing "y/n" | Med | Full build | Detect approval prompts in terminal stream via pattern matching; overlay buttons. Huge UX win |
| Clickable file paths | Claude Code outputs file paths constantly -- make them clickable to open in default editor or copy path | Med | Full build | Regex detect file paths in terminal output; linkify. xterm.js has web links addon |
| Session naming and organization | Name sessions by task ("Auth refactor", "DB migration") instead of anonymous terminal tabs | Low | Full build | Already in testbed design. Simple metadata layer |
| Token/cost estimation | Show running token usage estimate per session. Claude Code shows this in output but it scrolls away | Med | Full build | Parse Claude Code output for token counts; display in persistent header/footer |
| Mission Control launcher | Central dashboard showing all sessions, their status, quick launch. Not just a sidebar -- a dedicated view | Med | Full build | Already in PROJECT.md requirements. Differentiates from "just another terminal tab" |
| Markdown-rendered AI responses | Claude Code outputs markdown in terminal. Optionally render responses with proper markdown formatting (code blocks, headers, lists) | High | Defer | Requires parsing Claude Code's output format to separate AI responses from tool use. Complex but high-value |
| Context/prompt staging area | Write and edit context/prompts in a rich editor, inject into session. The original Wingman v1 value prop | Med | Full build | Already designed in testbed. Key differentiator. Pairs with --manual mode |
| Session search / history | Search across all sessions and prompt history | Med | Full build | Already in testbed. Valuable for "what did I ask about X last week?" |
| Multi-window session management | Each session in its own browser window/tab, all connected to same server | Med | Full build | Already in PROJECT.md. Natural browser affordance; terminals can't do this easily |
| Keyboard shortcut overlay | Show available shortcuts in a discoverable way (Cmd+K style palette) | Low | Full build | Low effort, high polish. Warp and VS Code both do this well |
| Dark/light theme toggle | Developers have strong theme preferences; terminal-style UI must support dark mode at minimum | Low | Full build | Testbed is already dark-themed. Adding light theme is CSS-only |
| Session auto-naming from first prompt | Auto-generate session name from the first thing the user asks Claude | Low | Full build | Quality-of-life. Parse first user input, truncate to ~40 chars |

## Anti-Features

Features to deliberately NOT build. These are traps that would consume time without proportional value, or that conflict with the product's philosophy.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Built-in code editor / IDE | Scope explosion. Users already have VS Code / Cursor / Neovim. Wingman is a terminal wrapper, not an IDE | Link file paths to open in external editor (clickable paths) |
| File tree / project browser | Same as above -- IDE territory. Claude Code already has file context | Show project path in header; let Claude Code handle file operations |
| Diff viewer for AI changes | Claude Code shows diffs in terminal output; building a custom diff viewer is a rabbit hole | Let the terminal render diffs natively with ANSI colors; optionally linkify to external diff tool |
| Git integration UI | Git operations belong in the terminal or IDE, not in a wrapper | Claude Code handles git via tool use; don't duplicate |
| AI model selection / provider switching | Wingman wraps Claude Code specifically; multi-provider support dilutes focus | If users want different AI, they use different tools. Wingman = Claude Code |
| Chat-style message bubbles UI | Tempting but wrong. Claude Code is a terminal tool, not a chatbot. Forcing chat UI loses terminal fidelity (ANSI art, progress bars, tool use formatting) | Use real terminal emulation (xterm.js). The terminal IS the chat interface |
| Collaborative / multi-user sessions | Massive complexity; niche use case for a local dev tool | Single user, multiple sessions. If collaboration needed, screen share |
| Plugin/extension system | Premature abstraction. Build the core features first; extract extension points only when patterns emerge | Hardcode features. Refactor to extensible only if 3+ similar features exist |
| Cloud/remote deployment | Wingman runs locally by design (npx). Adding cloud hosting is a different product | Keep it local. If users want cloud terminals, they use Codespaces/Gitpod |
| Prompt marketplace / sharing | Social features distract from core dev workflow tool | Local prompt templates only. Users can share files manually if needed |
| Speech-to-text input | v1 had this. Marginal utility for coding; adds native dependency complexity | Remove. Keyboard input is faster for code-related prompts |
| Notification system for long-running tasks | Sounds useful but Claude Code sessions are interactive -- user is watching. For background tasks, use the terminal's own bell | If needed later, use browser Notification API (trivial) |

## Feature Dependencies

```
Terminal emulation (xterm.js) --> Bidirectional I/O --> Everything else
                                       |
WebSocket server ----------------------+
       |
       +--> Session persistence (server-side buffer)
       |         |
       |         +--> Session reconnection
       |         +--> Multi-window management
       |
       +--> Process lifecycle management
                |
                +--> PID lock file (single instance)
                +--> Graceful shutdown
                +--> Orphan process cleanup

Slash command autocomplete --> requires: known command list (static or parsed)
Tool use approval buttons --> requires: terminal output pattern matching
Clickable file paths --> requires: xterm.js web links addon
Token estimation --> requires: terminal output parsing
Context/prompt staging --> independent (can work with --manual mode first)
Mission Control --> requires: session list, new session creation
```

## MVP Recommendation

### PoC Phase (validate the pipe)

Prioritize -- these prove the concept works:
1. **xterm.js terminal in browser** with full ANSI support
2. **WebSocket bridge** to node-pty spawning Claude Code
3. **Bidirectional I/O** -- type commands, see output
4. **Terminal resize** handling
5. **Connection status** indicator

This is the minimum to answer: "Can we run Claude Code in a browser with full fidelity?"

### Core Phase (earn the product's existence)

Prioritize -- these make Wingman worth using over raw terminal:
1. **Session persistence** -- server buffers output, tab close is safe
2. **Session reconnection** -- reopen tab, get full history
3. **Multi-session management** -- sidebar with session list
4. **Mission Control** -- launcher view
5. **Process lifecycle** -- clean spawn/kill, PID lock, orphan cleanup
6. **Tool use approval buttons** -- biggest UX win over raw terminal
7. **Slash command autocomplete** -- second biggest UX win

### Defer

- **Markdown-rendered responses**: High complexity, requires deep Claude Code output parsing. Do this only after core is stable. The terminal rendering is already good enough.
- **Token/cost estimation**: Nice to have but not critical. Claude Code already shows this intermittently.
- **Context/prompt staging area**: The testbed already has this UI. Port it to work with --manual mode, but don't block PoC on it.
- **Theme system**: Dark theme only for v1. Light theme is a polish item.

## Comparable Products and Feature Expectations

Based on training data knowledge of the ecosystem (MEDIUM confidence -- no live verification possible):

| Product | Relevant Features Wingman Should Learn From |
|---------|----------------------------------------------|
| **Warp** (terminal) | Command palette, slash command autocomplete, block-based output, AI integration UX |
| **VS Code integrated terminal** | Terminal tabs, split panes, process lifecycle, link detection, resize handling |
| **ttyd** (terminal in browser) | Minimal server architecture, WebSocket + node-pty pattern, reconnection |
| **Wetty** (web terminal) | Session persistence, authentication (not needed for local), HTTPS |
| **GitHub Codespaces terminal** | Multi-terminal management, port forwarding (not needed), process lifecycle |
| **Cursor** (AI IDE) | Inline diff approval, command palette for AI commands, chat + terminal coexistence |
| **Aider** (CLI AI tool) | Terminal-native UX, /commands, file context management |
| **Continue.dev** | Slash commands, context providers, sidebar panel UX |

## Key Insight

The critical insight for Wingman's feature set: the product lives or dies on **terminal fidelity**. If Claude Code's rich terminal output (ANSI colors, spinners, tool use boxes, diff output) doesn't render perfectly in the browser, users will go back to their real terminal immediately. xterm.js provides this fidelity. The differentiators (approval buttons, autocomplete, session persistence) are layered ON TOP of perfect terminal emulation -- they don't replace it.

Do NOT fall into the trap of building a "chat UI that talks to Claude Code." Build a "terminal that happens to be in a browser, with superpowers."

## Sources

- Training data knowledge of xterm.js, node-pty, ttyd, Wetty, Warp, VS Code terminal architecture
- Training data knowledge of Claude Code CLI, Cursor, Aider, Continue.dev feature sets
- Wingman PROJECT.md requirements and testbed code analysis
- **Confidence note:** WebSearch and WebFetch were unavailable. All ecosystem claims are MEDIUM confidence based on training data (cutoff ~May 2025). Specific version numbers and recent feature additions should be verified before implementation.
