'use strict';

const fs = require('fs');
const { loadConfig } = require('../config');
const { startService, startDialerWorker } = require('../service');
const { isLinux } = require('../proc');
const { logPackageSource } = require('../install');
const log = require('../log');

async function waitMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForIpcFile(ipcFile, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(ipcFile)) {
      try {
        const port = Number(fs.readFileSync(ipcFile, 'utf8').trim());
        if (port > 0) return port;
      } catch {
        /* retry */
      }
    }
    await waitMs(300);
  }
  throw new Error(`timeout waiting for IPC file ${ipcFile}`);
}

async function cmdStart(opts) {
  if (!isLinux()) {
    throw new Error('hsvpn start 仅支持 Linux host 模式');
  }
  logPackageSource('start');
  const cfg = loadConfig(opts.workdir || process.cwd());
  startService(cfg);
  const port = await waitForIpcFile(cfg.ipc_file, Number(opts.waitMs) || 15000);
  log.info(`IPC ready port=${port}`);
  startDialerWorker(cfg);
  log.info('start done — 用 hsvpn status 查看 tun0 / 进程');
}

module.exports = { cmdStart };