'use strict';

/**
 * Hillstone IPC dialer (Node port of hs_dial_keepalive.py, 5.7.1.12488).
 *
 * Framing: "deaf" + u32le(version=2) + u32le(len) + payload
 * Transport: TCP 127.0.0.1:<port> where port is read from IPC file.
 */

const net = require('net');
const fs = require('fs');
const crypto = require('crypto');
const { encryptPassword } = require('./crypto');
const log = require('./log');

function encodeFrame(payload) {
  const body = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(
        typeof payload === 'string' ? payload : JSON.stringify(payload),
        'utf8'
      );
  const hdr = Buffer.alloc(4 + 4 + 4);
  hdr.write('deaf', 0, 4, 'ascii');
  hdr.writeUInt32LE(2, 4);
  hdr.writeUInt32LE(body.length, 8);
  return Buffer.concat([hdr, body]);
}

function readIpcPort(ipcFile) {
  const raw = fs.readFileSync(ipcFile, 'utf8').trim();
  const port = Number(raw);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`invalid IPC port in ${ipcFile}: ${raw}`);
  }
  return port;
}

function connectTcp(port, host = '127.0.0.1', timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host, port });
    const t = setTimeout(() => {
      sock.destroy();
      reject(new Error(`IPC connect timeout ${host}:${port}`));
    }, timeoutMs);
    const onErr = (err) => {
      clearTimeout(t);
      sock.destroy();
      reject(err);
    };
    sock.once('error', onErr);
    sock.once('connect', () => {
      clearTimeout(t);
      sock.removeListener('error', onErr);
      resolve(sock);
    });
  });
}

function buildStartMsg(cfg) {
  const ud = cfg.userdata_dir;
  const uiUUID = crypto.randomBytes(16).toString('hex').toUpperCase();
  return {
    type: 'start',
    userDataPath: ud,
    userConfigPath: ud,
    serverResourcePath: ud,
    systemTextCode: 'utf-8',
    clientType: 'scvpn',
    profileName: cfg.profile || 'default',
    needQueryAuthType: false,
    keepAuthType: true,
    lastTimeSupportedAuthType: [],
    processID: process.pid,
    uiUUID,
    sslvpnOnly: false,
    UIAdmin: true,
    server: cfg.gateway.host,
    port: Number(cfg.gateway.port) || 64433,
    enableGMSSL: false,
    authType: 'pwd',
    authServerDisplayName: '',
    user: cfg.auth.username,
    encryptedPassword: encryptPassword(cfg.password),
    enableSPA: cfg.enable_spa !== false,
    commOptimMode: 2,
    logLevel: 'info',
    concurrentTestNum: 0,
    heartbeatTimeout: 180,
    optimalChannel: false,
    gatewayDetect: true,
    perferredGatewayName: '',
    enableVerifyServerCert: false,
    enableAutoReconnect: true,
    enableAutoUpdate: true,
    hasPromotedUpdate: false,
    gatewayList: [],
    clusterList: [],
  };
}

/**
 * Run dialer forever. Used by `hsvpn dialer` worker.
 */
async function runDialerLoop(cfg, { signal } = {}) {
  const ipcFile = cfg.ipc_file;
  const keepaliveSec = Number(cfg.dial?.keepalive_sec) || 1;
  const reconnectSec = Number(cfg.dial?.reconnect_sec) || 5;

  log.info(
    `dialer start ipc_file=${ipcFile} gateway=${cfg.gateway.host}:${cfg.gateway.port} user=${cfg.auth.username}`
  );

  while (!signal?.aborted) {
    let sock;
    let port;
    try {
      if (!fs.existsSync(ipcFile)) {
        throw new Error(`IPC file missing: ${ipcFile} (is Service running?)`);
      }
      port = readIpcPort(ipcFile);
      sock = await connectTcp(port);
    } catch (e) {
      log.warn(`IPC connect failed: ${e.message}; retry in ${reconnectSec}s`);
      await sleep(reconnectSec * 1000, signal);
      continue;
    }

    let alive = true;
    let kaTimer;
    let online = false;

    const cleanup = () => {
      alive = false;
      if (kaTimer) clearInterval(kaTimer);
      try {
        sock.destroy();
      } catch (_) {
        /* ignore */
      }
    };

    sock.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      if (!online && (text.includes('ONLINE') || text.includes('40971'))) {
        online = true;
        log.info('ONLINE');
      } else {
        const preview = text.replace(/\s+/g, ' ').slice(0, 200);
        if (preview) log.info('IPC <<', preview);
      }
    });
    sock.on('error', (err) => {
      log.warn('IPC error:', err.message);
      cleanup();
    });
    sock.on('close', () => {
      log.warn('IPC closed');
      cleanup();
    });

    try {
      const start = buildStartMsg(cfg);
      const payload = Buffer.from(JSON.stringify(start), 'utf8');
      sock.write(encodeFrame(payload));
      log.info(`IPC >> start (encryptedPassword) tcp=127.0.0.1:${port}`);
    } catch (e) {
      log.error('failed to send start:', e.message);
      cleanup();
      await sleep(reconnectSec * 1000, signal);
      continue;
    }

    // Match Python dialer: poll serviceState about once per second (socket timeout 1s loop)
    kaTimer = setInterval(() => {
      if (!alive) return;
      try {
        sock.write(encodeFrame('{"type":"get","subtype":"serviceState"}'));
      } catch (e) {
        log.warn('keepalive write failed:', e.message);
        cleanup();
      }
    }, Math.max(1000, keepaliveSec * 1000));

    while (alive && !signal?.aborted) {
      await sleep(500, signal);
    }
    cleanup();
    if (signal?.aborted) break;
    log.info(`reconnect in ${reconnectSec}s`);
    await sleep(reconnectSec * 1000, signal);
  }
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener?.(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}

module.exports = {
  encodeFrame,
  readIpcPort,
  buildStartMsg,
  runDialerLoop,
  encryptPassword,
};