'use strict';

const { loadConfig } = require('../config');
const { stopDialer, stopService } = require('../service');
const { workPaths, DEFAULT_INSTALL_DIR, DEFAULT_IPC_FILE } = require('../paths');
const log = require('../log');

function cmdStop(opts) {
  let cfg;
  try {
    cfg = loadConfig(opts.workdir || process.cwd());
  } catch (e) {
    const paths = workPaths(opts.workdir || process.cwd());
    cfg = {
      paths,
      install_dir: DEFAULT_INSTALL_DIR,
      ipc_file: DEFAULT_IPC_FILE,
      password: '',
    };
    log.warn(`config incomplete (${e.message}); stopping by pid files only`);
  }
  stopDialer(cfg);
  stopService(cfg);
  log.info('stop done');
}

module.exports = { cmdStop };