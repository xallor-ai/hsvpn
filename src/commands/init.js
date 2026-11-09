'use strict';

const fs = require('fs');
const path = require('path');
const { workPaths, TEMPLATES_DIR } = require('../paths');
const { writeSampleConfig } = require('../config');
const { installFromBundled, logPackageSource, alreadyInstalled } = require('../install');
const { isLinux } = require('../proc');
const log = require('../log');

function cmdInit(opts) {
  const paths = workPaths(opts.workdir || process.cwd());
  fs.mkdirSync(paths.root, { recursive: true });
  fs.mkdirSync(paths.logs, { recursive: true });
  fs.mkdirSync(paths.pids, { recursive: true });

  logPackageSource('init');

  if (!fs.existsSync(paths.config)) {
    const tpl = path.join(TEMPLATES_DIR, 'config.yaml');
    if (fs.existsSync(tpl)) {
      fs.copyFileSync(tpl, paths.config);
      // apply CLI overrides onto template if provided
      if (opts.gateway || opts.username || opts.password) {
        const yaml = require('js-yaml');
        const raw = yaml.load(fs.readFileSync(paths.config, 'utf8')) || {};
        if (opts.gateway) raw.gateway = { ...(raw.gateway || {}), host: opts.gateway };
        if (opts.port) raw.gateway = { ...(raw.gateway || {}), port: Number(opts.port) };
        if (opts.username) raw.auth = { ...(raw.auth || {}), username: opts.username };
        if (opts.password) raw.auth = { ...(raw.auth || {}), password: opts.password };
        fs.writeFileSync(paths.config, yaml.dump(raw, { lineWidth: 100, noRefs: true }), 'utf8');
      }
    } else {
      writeSampleConfig(paths.config, {
        gateway: { host: opts.gateway || '', port: Number(opts.port) || 64433 },
        auth: { username: opts.username || '', password: opts.password || '' },
      });
    }
    log.info(`wrote ${paths.config} — 填好 gateway / auth 后 hsvpn start`);
  } else {
    log.info(`keep existing ${paths.config}`);
  }

  const skipInstall = opts.skipInstall || opts['skip-install'];
  if (skipInstall) {
    log.info('skip install (--skip-install)');
    return;
  }

  if (!isLinux()) {
    log.warn('非 Linux：已生成 config.yaml，跳过 .run 安装。把工作目录拷到 Linux 主机后再 hsvpn init');
    return;
  }

  if (alreadyInstalled(opts.installDir) && !opts.force) {
    log.info('Hillstone 已安装，跳过 installer');
    return;
  }

  installFromBundled({ installDir: opts.installDir, force: !!opts.force });
}

module.exports = { cmdInit };