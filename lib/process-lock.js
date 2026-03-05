// lib/process-lock.js
// PID-based single-instance lock for Wingman.
// Prevents multiple Wingman instances from running in the same project directory.

const fs = require('fs');
const path = require('path');

/**
 * Acquire a PID lock file.
 * - If a live process holds the lock, print the existing URL and exit.
 * - If the lock is stale (process dead), clean it up and proceed.
 * - Write current PID + port to the lock file.
 * @param {string} lockPath - Absolute path to the .pid file
 * @param {number} port - Port the server will listen on
 */
function acquireLock(lockPath, port) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });

  if (fs.existsSync(lockPath)) {
    let existingPid, existingPort;
    try {
      const data = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      existingPid = data.pid;
      existingPort = data.port;
    } catch (_) {
      // Corrupt lock file — treat as stale
      fs.unlinkSync(lockPath);
    }

    if (existingPid) {
      let alive = false;
      try {
        process.kill(existingPid, 0);
        alive = true;
      } catch (_) {
        // Process is dead — stale lock
      }

      if (alive) {
        console.log(`Wingman already running at http://localhost:${existingPort}`);
        process.exit(0);
      } else {
        // Stale lock from a previous crash
        fs.unlinkSync(lockPath);
        console.log('Cleaned up stale lock file.');
      }
    }
  }

  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, port }), 'utf-8');
}

/**
 * Release the PID lock file.
 * Silently ignores errors (file may already be gone after a crash).
 * @param {string} lockPath - Absolute path to the .pid file
 */
function releaseLock(lockPath) {
  try {
    fs.unlinkSync(lockPath);
  } catch (_) {
    // Already gone — not an error
  }
}

module.exports = { acquireLock, releaseLock };
