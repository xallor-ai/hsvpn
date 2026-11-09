'use strict';

function ts() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function info(...args) {
  console.log(`[${ts()}]`, ...args);
}

function warn(...args) {
  console.warn(`[${ts()}] WARN`, ...args);
}

function error(...args) {
  console.error(`[${ts()}] ERROR`, ...args);
}

module.exports = { info, warn, error, ts };