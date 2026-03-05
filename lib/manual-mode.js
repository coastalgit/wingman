// lib/manual-mode.js
// Manual mode: creates cprompt.md and ccontext.md for file-based prompt staging.
// Used with --manual flag so developers can use Wingman without spawning Claude PTY sessions.

const fs = require('fs');
const path = require('path');

/**
 * Initialize manual mode files in the Wingman directory.
 * Creates cprompt.md and ccontext.md with template content if they don't exist.
 * @param {string} wingmanDir - Path to .ai/wingman/ directory
 * @returns {{ promptPath: string, contextPath: string }}
 */
function initManualMode(wingmanDir) {
  fs.mkdirSync(wingmanDir, { recursive: true });

  const promptPath = path.join(wingmanDir, 'cprompt.md');
  const contextPath = path.join(wingmanDir, 'ccontext.md');

  if (!fs.existsSync(promptPath)) {
    fs.writeFileSync(promptPath, '# Prompt\n\nWrite your prompt here.\n', 'utf-8');
  }
  if (!fs.existsSync(contextPath)) {
    fs.writeFileSync(contextPath, '# Context\n\nWrite your context here.\n', 'utf-8');
  }

  return { promptPath, contextPath };
}

module.exports = { initManualMode };
