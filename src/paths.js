'use strict';

const path = require('path');
const os = require('os');

const PKG_ROOT = path.resolve(__dirname, '..');
const VENDOR_DIR = path.join(PKG_ROOT, 'vendor');
const TEMPLATES_DIR = path.join(PKG_ROOT, 'templates');

const RUN_FILENAME = 'HillstoneSecureConnect_5.7.1.12488_c5c25286.run';
const RUN_PATH = path.join(VENDOR_DIR, RUN_FILENAME);
const SOURCE_PATH = path.join(VENDOR_DIR, 'SOURCE.txt');

const DEFAULT_INSTALL_DIR = '/opt/HillstoneSecureConnect';
const DEFAULT_IPC_FILE = '/tmp/HillstoneSecureConnectipc';
const DEFAULT_USERDATA = path.join(
  os.homedir(),
  '.local',
  'share',
  'HillstoneSecureConnect'
);

function resolveWorkDir(cwd = process.cwd()) {
  return path.resolve(cwd);
}

function workPaths(workdir) {
  const root = resolveWorkDir(workdir);
  return {
    root,
    config: path.join(root, 'config.yaml'),
    env: path.join(root, '.env'),
    logs: path.join(root, 'logs'),
    pids: path.join(root, 'pids'),
    servicePid: path.join(root, 'pids', 'service.pid'),
    dialerPid: path.join(root, 'pids', 'dialer.pid'),
    serviceLog: path.join(root, 'logs', 'service.log'),
    dialerLog: path.join(root, 'logs', 'dialer.log'),
  };
}

module.exports = {
  PKG_ROOT,
  VENDOR_DIR,
  TEMPLATES_DIR,
  RUN_FILENAME,
  RUN_PATH,
  SOURCE_PATH,
  DEFAULT_INSTALL_DIR,
  DEFAULT_IPC_FILE,
  DEFAULT_USERDATA,
  resolveWorkDir,
  workPaths,
};