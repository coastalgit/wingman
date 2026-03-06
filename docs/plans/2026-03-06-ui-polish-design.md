# UI Polish — Design Plan
**Date:** 2026-03-06
**Branch:** `feature/ui-polish`
**Source:** `temp/changes-1.md`

---

## Context

Wingman is a Node.js/Express server with a browser UI (`public/`) consisting of two pages:
- **Mission Control** (`mission-control.html/.css/.js`) — session dashboard
- **Session** (`session.html/.css/.js`, `terminal.js`, `session-ui.js`) — per-session terminal + editor

The Flutter app is retired. All work targets `public/` and `lib/`.

---

## Problems to Solve (from changes-1.md)

1. **Theme not applied** — Apply the Claude theme (`tweakcn.com/themes/cmmf0iy9y000904l8232re8yc`) properly across both pages
2. **Component inconsistency** — Buttons, footers, headers don't match between MC and Session pages
3. **MC cards look poor** — Cards blend into background; delete icons invisible
4. **No auto-context-send** — First prompt should auto-send context first (if not blank)
5. **Missing default template** — Context should pre-fill with "Ensure you load your CLAUDE.md"
6. **Missing seshmem template** — Need a "Seshmem Loader" template for `/seshmem:load`

---

## Claude Theme Tokens (Dark Mode)

Source: `tweakcn.com/themes/cmmf0iy9y000904l8232re8yc`

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-root` | `#262624` | Page background |
| `--bg-raised` | `#3b3b3b` | Cards, header, footer |
| `--bg-overlay` | `#30302e` | Hover states, popovers |
| `--bg-input` | `#52514a` | Input fields |
| `--bg-base` | `#1f1e1d` | Darkest surface (sidebars) |
| `--primary` | `#d97757` | Terracotta — all CTAs, accents |
| `--text-1` | `#faf9f5` | Primary text |
| `--text-2` | `#c3c0b6` | Secondary text |
| `--text-3` | `#b7b5a9` | Muted text, labels |
| `--border-1` | `#3e3e38` | Default borders |
| `--radius` | `0.5rem` | All border-radius |
| `--font-sans` | `Poppins` | All UI text |
| `--font-mono` | `IBM Plex Mono` | Code, meta, terminal labels |

---

## Implementation Tasks

### Task 1 — Shared token baseline (both CSS files)
- Both `mission-control.css` and `session.css` use **identical** `:root` token block
- `@import` Google Fonts (Poppins + IBM Plex Mono) in CSS itself (not just HTML `<link>`)
- Purge all hardcoded old colour values (`rgba(223,96,53,...)`, `#111111`, `#0f0f0f`)
- Fix any broken `var()` references (e.g. `var(--brand)` is undefined)

### Task 2 — Consistent shared components
Both pages must use identical styling for:
- `.app-header` — `bg-raised`, 56px, orange gradient underline
- `.brand-mark` — 32px, primary terracotta, glow shadow
- `.brand-name` — Poppins 700, 17px
- `.status-bar` — `bg-raised`, border-top, same padding (20px), same font (mono)
- Exit buttons — `.exit-btn` and `.exit-session-btn` — identical: danger border, danger text

### Task 3 — Mission Control card styling
- Card bg: `--bg-raised` (`#3b3b3b`) — clearly elevated over `--bg-root` (`#262624`)
- Card border: `--border-1` (`#3e3e38`) with `inset` white glow for depth
- Active cards: orange left-border (3px), `--bg-overlay` background
- Hover: lift + shadow
- Delete (trash) icons: always visible at `rgba(239,68,68,0.6)`, full danger on hover

### Task 4 — Auto-send context on first prompt
In `session-ui.js`:
- Track `contextAutoSent` flag per session
- On first prompt send: if context editor has content → silently POST to `/context` first
- If session already has history on load → set `contextAutoSent = true` (skip on reconnect)

### Task 5 — Default template + seshmem template
In `lib/session-manager.js` default config:
- `default` template: includes "Ensure you load your CLAUDE.md"
- `seshmemLoader` template: explains `/seshmem:load` with options and extra args section
- On session load: if context is blank, pre-fill with `default` template

### Task 6 — Session loading overlay
In `session.html` + `session.css` + `session-ui.js`:
- Show spinner overlay while terminal connects
- Dismiss after `handshake-ack` + double `requestAnimationFrame` (gives terminal time to render)
- Call `fitAddon.fit()` after overlay hidden

---

## Verification

After all changes, sync to `testbed/` and confirm:
- [ ] MC background is visibly `#262624` (warm mid-dark, not near-black)
- [ ] Session cards at `#3b3b3b` clearly pop off background
- [ ] Delete icons show red tint without hovering
- [ ] Poppins font rendering (rounder, different weight than Outfit)
- [ ] Exit Wingman and Exit Session buttons look identical
- [ ] Footer (status bar) looks identical on both pages
- [ ] Sending first prompt auto-sends context first (visible in terminal as `/ccc`)
- [ ] New session context pre-filled with default template
- [ ] Seshmem Loader appears in template dropdown
- [ ] Spinner shows on session load, dismisses when terminal appears

---

## Files Changed

| File | Change |
|------|--------|
| `public/mission-control.css` | Full token rewrite, card styles, consistent components |
| `public/mission-control.html` | Google Fonts link update |
| `public/session.css` | Full token rewrite, consistent with MC |
| `public/session.html` | Google Fonts link, loading overlay HTML |
| `public/session-ui.js` | Auto-context-send, default template pre-fill, overlay dismiss |
| `public/terminal.js` | Double-rAF before firing session-ready event |
| `lib/session-manager.js` | New default + seshmem templates |
