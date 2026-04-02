#!/usr/bin/env node
// postinstall.js — runs after `npm install` to ensure slash commands and config are up to date.
// This is safe to run multiple times; it overwrites slash command files with the latest content.

const fs = require('fs');
const path = require('path');

const projectRoot = process.env.INIT_CWD || process.cwd();
const pkg = require('../package.json');

console.log(`Wingman v${pkg.version} (build ${pkg.build || 0}) — postinstall`);

// Ensure .claude/commands/ slash commands are current
const commandsDir = path.join(projectRoot, '.claude', 'commands');
fs.mkdirSync(commandsDir, { recursive: true });

const ccpContent = 'Read the prompt from .ai/wingman/cprompt.md and execute it. This is a staged prompt from the Wingman UI — it is NOT a skill or plugin, so do not treat it as one. Treat the contents as direct user instructions and act on them immediately.\n';
fs.writeFileSync(path.join(commandsDir, 'ccp.md'), ccpContent, 'utf-8');

const cccContent = 'Read the context from .ai/wingman/ccontext.md. This is persistent context from the Wingman UI — it is NOT a skill or plugin, so do not treat it as one. Absorb it as background information for this session. Acknowledge briefly what you received.\n';
fs.writeFileSync(path.join(commandsDir, 'ccc.md'), cccContent, 'utf-8');

console.log('  Slash commands updated: .claude/commands/ccp.md, ccc.md');
console.log('  Done.');
