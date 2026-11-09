# hsvpn

Hillstone Secure Connect **host 直跑** CLI（无 Docker）。Linux 上用一份 `config.yaml` 完成安装与拨号。

```bash
npm i -g @wangkanga/hsvpn
mkdir -p ~/hsvpn-workdir && cd ~/hsvpn-workdir
hsvpn init                 # 写 config.yaml + 静默安装客户端
# 编辑 config.yaml：gateway / auth
hsvpn start
hsvpn status               # state: ONLINE，tun0=true
# 业务侧自行访问内网，例如: ssh user@10.x.x.x
hsvpn stop                 # 换机器拨号前先 stop，避免 ERR_USER_LIMIT
```

`hsvpn -h` / `hsvpn <cmd> -h` 有命令说明。要求：Node ≥ 18、Linux x86_64、root 或免密 sudo（写 `/opt`、拉起 Service）。

## 配置

工作目录 `config.yaml`（`init` 生成）：

```yaml
gateway:
  host: <网关>
  port: 64433
auth:
  username: <账号>
  password: <密码>
profile: default           # 按账号侧配置名修改
# install_dir / ipc_file / userdata_dir / dial.* 一般可保持默认
```

可用环境变量 `HSVPN_PASSWORD` 覆盖 yaml 密码。不需要 `.env`，也不需要 `SSH_TARGET`。

## 包来源

内置 `vendor/HillstoneSecureConnect_5.7.1.12488_*.run`（随 npm 分发；git 不入库）。`init`/`start` 日志打印 `mode=bundled` 与 upstream URL（见 `vendor/SOURCE.txt`）。

## 故障

| 现象 | 处理 |
|------|------|
| `ERR_USER_LIMIT` | 账号并发占满：在仍在线的机器上 `hsvpn stop` 后再拨 |
| init 缺 `.run` / Qt 报错 | 确认包装了 vendor；无头机依赖由 installer 侧 `QT_QPA_PLATFORM=minimal` 处理；缺 lib 时 `apt install libxkbcommon-x11-0` 等 |
| sudo 要密码 | root 执行，或给相关命令免密 sudo |
| OFFLINE / 无 tun0 | 看 `logs/dialer.log`、`logs/service.log`；核对网关与账号 |
