// temp/claude-start-test.js — test if native claude.exe starts via PTY
// Kill after 3s to just check for initial output / freeze
const pty = require('node-pty');
const BASH_PATH = process.env.WINGMAN_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe';

console.log('Testing claude startup via node-pty...');

const p = pty.spawn(BASH_PATH, ['-c', 'claude --version 2>&1; echo "CLAUDE_START_DONE"'], {
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

let received = false;
p.onData((data) => {
  received = true;
  process.stdout.write(data);
});

p.onExit(({ exitCode }) => {
  console.log('\nExit: ' + exitCode);
  process.exit(0);
});

// Give it 5 seconds to produce any output
setTimeout(() => {
  if (!received) {
    console.log('\nNO OUTPUT in 5s — possible freeze. Native binary may need workaround.');
  } else {
    console.log('\n[Killing after timeout]');
  }
  p.kill();
  process.exit(received ? 0 : 2);
}, 5000);
