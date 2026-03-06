# Wingman Web Demo

A visual demo of a web-based UI for **Wingman** - a prompt and context manager for AI coding tools.

This demo helps evaluate whether a web UI approach (vs. a TUI) is the right direction for the project.

## Quick Start

```bash
cd demo-web
npm install
node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Features Demonstrated

- **Context Tab** - Markdown editor with live preview for project context
- **Prompts Tab** - Prompt composer with history panel and search
- **Session Management** - Sidebar with sessions, each tied to a project and AI tool
- **Multi-Tool Support** - Tabs for Claude Code, Cursor CLI, and Gemini CLI
- **Status Bar** - Shows project directory, git branch, active tool, and clock

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1` | Switch to Context tab |
| `Ctrl+2` | Switch to Prompts tab |
| `Ctrl+Enter` | Send prompt (when on Prompts tab) |
| `Tab` | Insert 2 spaces in text areas |

## Notes

- All data is mock/demo data - nothing connects to real AI tools
- The server provides a simple Express backend with mock API endpoints
- Markdown rendering uses the `marked` library loaded from CDN
- Dark theme designed to match terminal/IDE aesthetics
