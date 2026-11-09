'use strict';

const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const log = require('./log');

function isLinux() {
  return process.platform === 'linux';
}

function readPid(pidFile) {
  try {
    const n = Number(fs.readFileSync(pidFile, 'utf8').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writePid(pidFile, pid) {
  fs.mkdirSync(path.dirname(pidFile), { recursive: true });
  fs.writeFileSync(pidFile, String(pid) + '\n', 'utf8');
}

function clearPid(pidFile) {
  try {
    fs.unlinkSync(pidFile);
  } catch {
    /* ignore */
  }
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPid(pid, sig = 'SIGTERM') {
  if (!pidAlive(pid)) return false;
  try {
    process.kill(pid, sig);
    return true;
  } catch (e) {
    log.warn(`kill ${pid} ${sig}: ${e.message}`);
    return false;
  }
}

/** Best-effort: kill by pid file, then optionally by name pattern via pkill. */
function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy wait — short windows only */
  }
}

function stopByPidFile(pidFile, { nameHint, forceAfterMs = 3000 } = {}) {
  const pid = readPid(pidFile);
  if (pid && pidAlive(pid)) {
    killPid(pid, 'SIGTERM');
    const deadline = Date.now() + forceAfterMs;
    while (Date.now() < deadline && pidAlive(pid)) {
      sleepSync(100);
    }
    if (pidAlive(pid)) killPid(pid, 'SIGKILL');
  }
  clearPid(pidFile);

  if (nameHint && isLinux()) {
    try {
      execFileSync('pkill', ['-f', nameHint], { stdio: 'ignore' });
    } catch {
      /* pkill exits 1 when no match */
    }
  }
}

function spawnDetached(cmd, args, { cwd, logFile, env } = {}) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const out = fs.openSync(logFile, 'a');
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
  return child.pid;
}

function runCapture(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });
    return { ok: true, code: 0, stdout: String(stdout) };
  } catch (e) {
    return {
      ok: false,
      code: e.status ?? 1,
      stdout: String(e.stdout || ''),
      stderr: String(e.stderr || e.message || ''),
    };
  }
}

function which(bin) {
  try {
    const r = execFileSync(process.platform === 'win32' ? 'where' : 'which', [bin], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return r.trim().split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

module.exports = {
  isLinux,
  readPid,
  writePid,
  clearPid,
  pidAlive,
  killPid,
  stopByPidFile,
  spawnDetached,
  runCapture,
  which,
};