// temp/pty-spike.js — ConPTY spike. Delete after validation.
const pty = require('node-pty');
const BASH_PATH = process.env.WINGMAN_BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe';

console.log('Spawning Git Bash via node-pty...');
console.log('BASH_PATH:', BASH_PATH);

const p = pty.spawn(BASH_PATH, ['-c', 'echo "PTY spike OK" && ls --version | head -1'], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
});

p.onData((data) => process.stdout.write(data));
p.onExit(({ exitCode }) => {
  console.log(`\nProcess exited with code: ${exitCode}`);
  process.exit(exitCode);
});

setTimeout(() => {
  console.log('\nTimeout — killing spike process');
  p.kill();
  process.exit(1);
}, 5000);
