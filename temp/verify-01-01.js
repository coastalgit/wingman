const fs = require('fs');

// Check package.json has node-pty
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (!pkg.dependencies['node-pty']) throw new Error('node-pty missing from package.json');
console.log('package.json: node-pty present');

// Check server.js has open(
const s = fs.readFileSync('server.js', 'utf8');
if (!s.includes('open(')) throw new Error('open( missing from server.js');
if (!s.includes('express.static')) throw new Error('express.static missing from server.js');
console.log('server.js: open( and express.static present');

// Check index.html has xterm.js
const h = fs.readFileSync('public/index.html', 'utf8');
if (!h.includes('xterm.js')) throw new Error('xterm.js missing from index.html');
console.log('index.html: xterm.js present');

// Check terminal.js has new Terminal and new WebSocket
const t = fs.readFileSync('public/terminal.js', 'utf8');
if (!t.includes('new Terminal')) throw new Error('new Terminal missing from terminal.js');
if (!t.includes('new WebSocket')) throw new Error('new WebSocket missing from terminal.js');
console.log('terminal.js: new Terminal and new WebSocket present');

// Check styles.css has #terminal
const c = fs.readFileSync('public/styles.css', 'utf8');
if (!c.includes('#terminal')) throw new Error('#terminal missing from styles.css');
console.log('styles.css: #terminal present');

// Check dependencies
require('express');
require('ws');
require('node-pty');
console.log('All dependencies load correctly');

console.log('\nAll artifact checks PASSED');
