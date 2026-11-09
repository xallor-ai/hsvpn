'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  RUN_PATH,
  RUN_FILENAME,
  SOURCE_PATH,
  TEMPLATES_DIR,
  DEFAULT_INSTALL_DIR,
} = require('./paths');
const { runCapture, which, isLinux } = require('./proc');
const log = require('./log');

function readSourceMeta() {
  const meta = {
    filename: RUN_FILENAME,
    path: RUN_PATH,
    bundled: fs.existsSync(RUN_PATH),
    size: null,
    url: null,
    version: '5.7.1.12488',
    note: null,
  };
  if (meta.bundled) {
    meta.size = fs.statSync(RUN_PATH).size;
  }
  if (fs.existsSync(SOURCE_PATH)) {
    const text = fs.readFileSync(SOURCE_PATH, 'utf8');
    meta.note = text.trim().split(/\r?\n/)[0] || null;
    const m = text.match(/https?:\/\/\S+/);
    if (m) meta.url = m[0];
  }
  return meta;
}

function logPackageSource(prefix = 'package source') {
  const m = readSourceMeta();
  log.info(
    `${prefix}: mode=bundled file=${m.filename} exists=${m.bundled}` +
      (m.size != null ? ` size=${m.size}` : '') +
      (m.version ? ` version=${m.version}` : '')
  );
  if (m.url) log.info(`${prefix}: upstream_url=${m.url}`);
  if (m.path) log.info(`${prefix}: local_path=${m.path}`);
  if (m.note) log.info(`${prefix}: ${m.note}`);
  return m;
}

function ensureBundledRun() {
  const m = logPackageSource('init');
  if (!m.bundled) {
    throw new Error(
      `bundled .run missing at ${RUN_PATH}. Place ${RUN_FILENAME} under vendor/ before init.`
    );
  }
  return m;
}

function serviceBinary(installDir = DEFAULT_INSTALL_DIR) {
  return path.join(installDir, 'bin', 'HillstoneSecureConnectService');
}

function alreadyInstalled(installDir = DEFAULT_INSTALL_DIR) {
  return fs.existsSync(serviceBinary(installDir));
}

/**
 * Silent-install Hillstone Secure Connect from bundled .run (Linux host).
 * Requires root or passwordless sudo for /opt write.
 */
function installFromBundled({ installDir = DEFAULT_INSTALL_DIR, force = false } = {}) {
  if (!isLinux()) {
    throw new Error('hsvpn init install only runs on Linux hosts (host mode)');
  }
  ensureBundledRun();

  if (alreadyInstalled(installDir) && !force) {
    log.info(`already installed: ${serviceBinary(installDir)} (use --force to reinstall)`);
    return { installed: true, skipped: true, installDir };
  }

  const qsSrc = path.join(TEMPLATES_DIR, 'silent-install.qs');
  if (!fs.existsSync(qsSrc)) {
    throw new Error(`missing silent-install.qs at ${qsSrc}`);
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsvpn-'));
  const runCopy = path.join(tmp, RUN_FILENAME);
  const qsCopy = path.join(tmp, 'silent-install.qs');
  fs.copyFileSync(RUN_PATH, runCopy);
  fs.copyFileSync(qsSrc, qsCopy);
  fs.chmodSync(runCopy, 0o755);

  const useSudo = process.getuid && process.getuid() !== 0;
  const sudo = useSudo ? which('sudo') : null;
  if (useSudo && !sudo) {
    throw new Error('root required to install under /opt (sudo not found)');
  }

  const installerArgs = [runCopy, '--script', qsCopy];
  log.info(`running installer: ${installerArgs.join(' ')}`);
  // Headless hosts: Qt installer needs a non-xcb platform plugin
  const installerEnv = {
    ...process.env,
    QT_QPA_PLATFORM: process.env.QT_QPA_PLATFORM || 'minimal',
    DISPLAY: process.env.DISPLAY || '',
  };

  let result;
  if (useSudo) {
    result = runCapture(
      sudo,
      ['-n', 'env', `QT_QPA_PLATFORM=${installerEnv.QT_QPA_PLATFORM}`, 'DISPLAY=', ...installerArgs],
      { timeout: 10 * 60 * 1000, env: installerEnv }
    );
    if (!result.ok && /password|a password is required/i.test(result.stderr || '')) {
      throw new Error(
        'sudo needs a password. Re-run as root, or configure passwordless sudo for the installer.'
      );
    }
  } else {
    result = runCapture(installerArgs[0], installerArgs.slice(1), {
      timeout: 10 * 60 * 1000,
      env: installerEnv,
    });
  }

  if (!result.ok) {
    throw new Error(
      `installer failed code=${result.code}: ${(result.stderr || result.stdout || '').slice(0, 800)}`
    );
  }

  if (!alreadyInstalled(installDir)) {
    throw new Error(
      `installer finished but ${serviceBinary(installDir)} not found — check Qt silent script / install path`
    );
  }

  log.info(`installed OK: ${serviceBinary(installDir)}`);
  return { installed: true, skipped: false, installDir };
}

module.exports = {
  readSourceMeta,
  logPackageSource,
  ensureBundledRun,
  serviceBinary,
  alreadyInstalled,
  installFromBundled,
};