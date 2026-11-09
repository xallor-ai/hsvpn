'use strict';

const { loadConfig } = require('../config');
const { statusSnapshot } = require('../service');
const {
  workPaths,
  DEFAULT_INSTALL_DIR,
  DEFAULT_IPC_FILE,
} = require('../paths');
const { readSourceMeta } = require('../install');

function cmdStatus(opts) {
  let cfg;
  try {
    cfg = loadConfig(opts.workdir || process.cwd());
  } catch {
    const paths = workPaths(opts.workdir || process.cwd());
    cfg = {
      paths,
      install_dir: DEFAULT_INSTALL_DIR,
      ipc_file: DEFAULT_IPC_FILE,
      gateway: { host: '?', port: '?' },
      auth: { username: '?' },
      password: '',
    };
  }
  const snap = statusSnapshot(cfg);
  const src = readSourceMeta();
  const online = snap.service.alive && snap.dialer.alive && snap.tun0;

  const lines = [
    `workdir:   ${snap.workdir}`,
    `gateway:   ${snap.gateway}`,
    `user:      ${snap.username}`,
    `service:   pid=${snap.service.pid || '-'} alive=${snap.service.alive}`,
    `dialer:    pid=${snap.dialer.pid || '-'} alive=${snap.dialer.alive}`,
    `ipc_file:  ${snap.ipc_file} port=${snap.ipc_port ?? '-'}`,
    `tun0:      ${snap.tun0}`,
    `package:   bundled=${src.bundled} file=${src.filename}` +
      (src.size != null ? ` size=${src.size}` : ''),
    `state:     ${online ? 'ONLINE' : 'OFFLINE'}`,
  ];
  console.log(lines.join('\n'));
  return { online, snap, src };
}

module.exports = { cmdStatus };