const pty = require('node-pty');
const BASH_PATH = 'C:\Program Files\Git\bin\bash.exe';

const p = pty.spawn(BASH_PATH, ['-c', 'which claude && claude --version 2>&1 | head -2'], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: { ...process.env, TERM: 'xterm-256color' },
});

let output = '';
p.onData((data) => { output += data; process.stdout.write(data); });
p.onExit(({ exitCode }) => {
  console.log(`\nExit: ${exitCode}`);
  process.exit(0);
});
setTimeout(() => { p.kill(); process.exit(1); }, 8000);
