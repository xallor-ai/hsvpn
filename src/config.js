'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const {
  DEFAULT_INSTALL_DIR,
  DEFAULT_IPC_FILE,
  DEFAULT_USERDATA,
  workPaths,
} = require('./paths');

function expandHome(p) {
  if (!p || typeof p !== 'string') return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

const DEFAULTS = {
  runtime: 'host',
  install_dir: DEFAULT_INSTALL_DIR,
  ipc_file: DEFAULT_IPC_FILE,
  userdata_dir: DEFAULT_USERDATA,
  profile: 'default',
  enable_spa: true,
  gateway: {
    host: '',
    port: 64433,
  },
  auth: {
    username: '',
    password: '',
  },
  dial: {
    keepalive_sec: 1,
    reconnect_sec: 5,
  },
};

/** Optional override only — primary password is config.yaml auth.password. */
function loadEnvFile(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i <= 0) continue;
    const key = s.slice(0, i).trim();
    let val = s.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(a[k] || {}, v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function loadConfig(workdir) {
  const paths = workPaths(workdir);
  if (!fs.existsSync(paths.config)) {
    throw new Error(`missing config.yaml at ${paths.config} — run: hsvpn init`);
  }
  const raw = yaml.load(fs.readFileSync(paths.config, 'utf8')) || {};
  // tolerate old ipc_sock key
  if (raw.ipc_sock && !raw.ipc_file) raw.ipc_file = raw.ipc_sock;
  const cfg = deepMerge(DEFAULTS, raw);

  const fileEnv = loadEnvFile(paths.env);
  // Priority: env override → config.yaml → legacy .env (optional)
  const password =
    process.env.HSVPN_PASSWORD ||
    process.env.HS_PASS ||
    cfg.auth?.password ||
    fileEnv.HSVPN_PASSWORD ||
    fileEnv.HS_PASS ||
    '';

  if (!cfg.gateway?.host) {
    throw new Error('config.yaml: gateway.host is required');
  }
  if (!cfg.auth?.username) {
    throw new Error('config.yaml: auth.username is required');
  }
  if (!password) {
    throw new Error('config.yaml: auth.password is required');
  }

  cfg.userdata_dir = expandHome(cfg.userdata_dir || DEFAULT_USERDATA);
  cfg.install_dir = expandHome(cfg.install_dir || DEFAULT_INSTALL_DIR);

  return {
    ...cfg,
    password,
    paths,
  };
}

function writeSampleConfig(configPath, overrides = {}) {
  const sample = deepMerge(DEFAULTS, overrides);
  const body = yaml.dump(sample, { lineWidth: 100, noRefs: true });
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, body, 'utf8');
}

module.exports = {
  DEFAULTS,
  loadConfig,
  loadEnvFile,
  writeSampleConfig,
  deepMerge,
};