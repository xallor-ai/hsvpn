# Changelog

## 1.0.0

- npm 名：`@wangkanga/hsvpn`（全局命令仍为 `hsvpn`）
- 正式版：host 直跑 `init` / `start` / `stop` / `status`
- 单一 `config.yaml`（含密码）；可选 `HSVPN_PASSWORD` 覆盖
- 无头安装：`QT_QPA_PLATFORM=minimal`；Service 经 sudo 拉起并记录真实 PID
- CLI `-h` 含示例与并发会话说明
- 内置 `.run` 5.7.1.12488（npm 打包；git 仅 SOURCE）

## 0.1.0

- 初版实现与联调
