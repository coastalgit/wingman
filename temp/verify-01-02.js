// temp/verify-01-02.js — verify server.js PTY wiring for Plan 01-02
const src = require('fs').readFileSync('server.js', 'utf8');

const checks = [
  ['pty.spawn', 'PTY spawn call'],
  ['ptyProcess.onData', 'PTY onData event handler'],
  ['ptyProcess.write', 'PTY write (input from browser)'],
  ['ptyProcess.resize', 'PTY resize propagation'],
  ['WINGMAN_BASH_PATH', 'WINGMAN_BASH_PATH env override'],
  ['dataHandler.dispose', 'dataHandler cleanup on disconnect'],
];

let passed = 0;
for (const [pattern, desc] of checks) {
  if (src.includes(pattern)) {
    console.log('PASS: ' + desc + ' (' + pattern + ')');
    passed++;
  } else {
    console.error('FAIL: ' + desc + ' (' + pattern + ' not found in server.js)');
  }
}

if (passed === checks.length) {
  console.log('\nAll ' + passed + '/' + checks.length + ' checks passed. server.js PTY wiring verified.');
  process.exit(0);
} else {
  console.error('\n' + (checks.length - passed) + ' checks FAILED.');
  process.exit(1);
}
