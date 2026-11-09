'use strict';

const { Command } = require('commander');
const { cmdInit } = require('./commands/init');
const { cmdStart } = require('./commands/start');
const { cmdStop } = require('./commands/stop');
const { cmdStatus } = require('./commands/status');
const { loadConfig } = require('./config');
const { runDialerLoop } = require('./dialer');
const { DEFAULT_INSTALL_DIR } = require('./paths');
const log = require('./log');
const pkg = require('../package.json');

function run(argv) {
  const program = new Command();
  program
    .name('hsvpn')
    .description(
      'Hillstone Secure Connect 通道 CLI（Linux host 直跑）。\n' +
        '工作目录一份 config.yaml（含网关/账号密码）即可 init → start → status → stop。'
    )
    .version(pkg.version)
    .addHelpText(
      'after',
      `
示例:
  hsvpn init -C /path/to/workdir
  # 编辑 workdir/config.yaml 的 gateway / auth
  hsvpn start -C /path/to/workdir
  hsvpn status -C /path/to/workdir    # 期望 state: ONLINE 且 tun0=true
  hsvpn stop  -C /path/to/workdir

说明:
  - 仅 Linux；init/start 需要 root 或免密 sudo（安装到 /opt、拉起 Service）
  - 账号有并发限制：换机器拨号前先在旧机器 hsvpn stop
  - 详情见 README.md
`
    );

  program
    .command('init')
    .description('生成 config.yaml；用内置 .run 静默安装客户端到 /opt（可 --skip-install）')
    .option('-C, --workdir <dir>', '工作目录（放 config.yaml / logs / pids）', process.cwd())
    .option('--gateway <host>', '写入 config 的网关主机')
    .option('--port <n>', '写入 config 的网关端口', '64433')
    .option('--username <user>', '写入 config 的用户名')
    .option('--password <pass>', '写入 config 的密码')
    .option('--install-dir <dir>', '客户端安装目录', DEFAULT_INSTALL_DIR)
    .option('--force', '已安装时仍重跑 installer', false)
    .option('--skip-install', '只写 config.yaml，不安装客户端', false)
    .action((opts) => {
      try {
        cmdInit(opts);
      } catch (e) {
        log.error(e.message);
        process.exitCode = 1;
      }
    });

  program
    .command('start')
    .description('读取 config.yaml：启动 Service + 拨号 keepalive（成功后 status 见 ONLINE）')
    .option('-C, --workdir <dir>', '工作目录', process.cwd())
    .action(async (opts) => {
      try {
        await cmdStart(opts);
      } catch (e) {
        log.error(e.message);
        process.exitCode = 1;
      }
    });

  program
    .command('stop')
    .description('停止拨号与 Service，释放 VPN 会话')
    .option('-C, --workdir <dir>', '工作目录', process.cwd())
    .action((opts) => {
      try {
        cmdStop(opts);
      } catch (e) {
        log.error(e.message);
        process.exitCode = 1;
      }
    });

  program
    .command('status')
    .description('查看 Service/拨号进程、tun0、包来源、ONLINE|OFFLINE')
    .option('-C, --workdir <dir>', '工作目录', process.cwd())
    .action((opts) => {
      try {
        cmdStatus(opts);
      } catch (e) {
        log.error(e.message);
        process.exitCode = 1;
      }
    });

  program
    .command('dialer', { hidden: true })
    .description('前台拨号循环（由 start 拉起）')
    .option('-C, --workdir <dir>', '工作目录', process.cwd())
    .action(async (opts) => {
      try {
        const cfg = loadConfig(opts.workdir || process.cwd());
        const ac = new AbortController();
        const stop = () => ac.abort();
        process.on('SIGTERM', stop);
        process.on('SIGINT', stop);
        await runDialerLoop(cfg, { signal: ac.signal });
      } catch (e) {
        log.error(e.message);
        process.exitCode = 1;
      }
    });

  program.parse(argv);
}

module.exports = { run };