// temp/claude-interactive-test.js — test if claude interactive mode starts via PTY
// Kill after 4s to just check for initial banner/prompt output
const pty = require('node-pty');
const BASH_PATH = process.env.WINGMAN_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe';

console.log('Testing claude interactive startup via node-pty (4s timeout)...');

const p = pty.spawn(BASH_PATH, ['-c', 'claude'], {
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

let outputChunks = [];
let received = false;

p.onData((data) => {
  received = true;
  outputChunks.push(data);
  process.stdout.write(data);
});

p.onExit(({ exitCode }) => {
  console.log('\nProcess exited with code: ' + exitCode);
  process.exit(0);
});

// Give it 4 seconds to show initial banner/prompt
setTimeout(() => {
  if (!received) {
    console.log('\nNO OUTPUT in 4s — possible freeze!');
    p.kill();
    process.exit(2);
  } else {
    console.log('\n[Got output - killing after 4s timeout]');
    p.kill();
    process.exit(0);
  }
}, 4000);
