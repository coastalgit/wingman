// temp/claude-probe.js — check what 'claude' resolves to inside Git Bash
const pty = require('node-pty');
const BASH_PATH = process.env.WINGMAN_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe';

console.log('Checking claude path inside Git Bash...');

const p = pty.spawn(BASH_PATH, ['-c', 'which claude 2>/dev/null || echo "claude not found in PATH"'], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: { ...process.env, TERM: 'xterm-256color' },
});

p.onData((data) => process.stdout.write(data));
p.onExit(({ exitCode }) => {
  console.log('\nExit: ' + exitCode);
  process.exit(0);
});

setTimeout(() => {
  console.log('\nTimeout — killing probe');
  p.kill();
  process.exit(1);
}, 8000);
