'use strict';

const fs = require('fs');
const path = require('path');
const { serviceBinary } = require('./install');
const {
  spawnDetached,
  stopByPidFile,
  readPid,
  pidAlive,
  runCapture,
  isLinux,
  writePid,
} = require('./proc');
const log = require('./log');

function startService(cfg) {
  if (!isLinux()) throw new Error('service start requires Linux');
  const bin = serviceBinary(cfg.install_dir);
  if (!fs.existsSync(bin)) {
    throw new Error(`service binary missing: ${bin} — run hsvpn init`);
  }
  const pid = readPid(cfg.paths.servicePid);
  if (pid && pidAlive(pid)) {
    log.info(`service already running pid=${pid}`);
    return { pid, already: true };
  }

  fs.mkdirSync(cfg.userdata_dir, { recursive: true });

  // Service needs root for tun/IPC; headless needs QT_QPA_PLATFORM=minimal
  const { which, runCapture: rc } = require('./proc');
  const sudo = which('sudo');
  const needSudo = typeof process.getuid === 'function' && process.getuid() !== 0;
  if (needSudo && sudo) {
    // sudo exits after spawn — record the real service PID via pgrep after start
    spawnDetached(
      sudo,
      ['-n', 'env', 'QT_QPA_PLATFORM=minimal', 'DISPLAY=', bin],
      {
        cwd: cfg.paths.root,
        logFile: cfg.paths.serviceLog,
      }
    );
  } else {
    const newPid = spawnDetached(bin, [], {
      cwd: cfg.paths.root,
      logFile: cfg.paths.serviceLog,
      env: { QT_QPA_PLATFORM: 'minimal', DISPLAY: '' },
    });
    writePid(cfg.paths.servicePid, newPid);
    log.info(`service started pid=${newPid} bin=${bin}`);
    return { pid: newPid, already: false };
  }
  // wait briefly then resolve HillstoneSecureConnectService PID
  const deadline = Date.now() + 5000;
  let realPid = null;
  while (Date.now() < deadline) {
    const r = rc('pgrep', ['-x', 'HillstoneSecureConnectService']);
    if (r.ok) {
      realPid = Number(String(r.stdout).trim().split(/\s+/)[0]);
      if (realPid) break;
    }
    const end = Date.now() + 100;
    while (Date.now() < end) {
      /* spin */
    }
  }
  if (!realPid) {
    throw new Error('service started via sudo but HillstoneSecureConnectService PID not found');
  }
  writePid(cfg.paths.servicePid, realPid);
  log.info(`service started pid=${realPid} bin=${bin}`);
  return { pid: realPid, already: false };
}

function stopService(cfg) {
  const pid = readPid(cfg.paths.servicePid);
  const sudo = require('./proc').which('sudo');
  if (pid && pidAlive(pid) && sudo && typeof process.getuid === 'function' && process.getuid() !== 0) {
    runCapture(sudo, ['-n', 'kill', '-TERM', String(pid)]);
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && pidAlive(pid)) {
      /* wait */
    }
    if (pidAlive(pid)) runCapture(sudo, ['-n', 'kill', '-KILL', String(pid)]);
    require('./proc').clearPid(cfg.paths.servicePid);
  } else {
    stopByPidFile(cfg.paths.servicePid, {});
  }
  // exact binary path — avoid broad pkill -f that can match the agent shell
  runCapture('pkill', ['-x', 'HillstoneSecureConnectService']);
  if (sudo) {
    runCapture(sudo, ['-n', 'pkill', '-x', 'HillstoneSecureConnectService']);
    runCapture(sudo, ['-n', 'rm', '-f', cfg.ipc_file || '/tmp/HillstoneSecureConnectipc']);
  }
  log.info('service stop requested');
}

function startDialerWorker(cfg) {
  const pid = readPid(cfg.paths.dialerPid);
  if (pid && pidAlive(pid)) {
    log.info(`dialer already running pid=${pid}`);
    return { pid, already: true };
  }
  const node = process.execPath;
  const cli = path.resolve(__dirname, '..', 'bin', 'hsvpn.js');
  const newPid = spawnDetached(
    node,
    [cli, 'dialer', '--workdir', cfg.paths.root],
    {
      cwd: cfg.paths.root,
      logFile: cfg.paths.dialerLog,
      env: {
        HSVPN_PASSWORD: cfg.password,
      },
    }
  );
  writePid(cfg.paths.dialerPid, newPid);
  log.info(`dialer started pid=${newPid}`);
  return { pid: newPid, already: false };
}

function stopDialer(cfg) {
  stopByPidFile(cfg.paths.dialerPid, { nameHint: 'hsvpn.*dialer' });
  log.info('dialer stop requested');
}

function tun0Up() {
  if (!isLinux()) return false;
  const r = runCapture('ip', ['-o', 'link', 'show', 'tun0']);
  // require operational UP — DOWN leftovers after stop must not count as online
  return r.ok && /tun0:/.test(r.stdout) && /\bUP\b/.test(r.stdout);
}

function statusSnapshot(cfg) {
  const svcPid = readPid(cfg.paths.servicePid);
  const dialPid = readPid(cfg.paths.dialerPid);
  let ipcPort = null;
  try {
    if (fs.existsSync(cfg.ipc_file)) {
      ipcPort = Number(fs.readFileSync(cfg.ipc_file, 'utf8').trim());
    }
  } catch {
    /* ignore */
  }
  return {
    workdir: cfg.paths.root,
    install_dir: cfg.install_dir,
    ipc_file: cfg.ipc_file,
    ipc_port: ipcPort,
    gateway: `${cfg.gateway.host}:${cfg.gateway.port}`,
    username: cfg.auth.username,
    service: {
      pid: svcPid,
      alive: pidAlive(svcPid),
    },
    dialer: {
      pid: dialPid,
      alive: pidAlive(dialPid),
    },
    tun0: tun0Up(),
  };
}

module.exports = {
  startService,
  stopService,
  startDialerWorker,
  stopDialer,
  statusSnapshot,
  tun0Up,
};