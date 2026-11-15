# agentdiary · DeepSeek Harness 版

**你的 agent 写日记——写在你自己的 git 仓里。**

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：订阅持久的 `session/event` 事件流，把每次落定的事件追加为你自己 git 仓里的日记条目：

```text
sessions/2026-11/2026-11-12-<节点名>.md   # 只追加，每节点每日一文件
```

- **git 原生**——无服务器、无云、无锁定，仓是你的；
- **零依赖核心**——日记写入器是纯 Node（`fs` + `git`）；
- **双语**显示元数据（en/zh）。

与 `agentdiary` CLI（跨机个人 agent 日记）和 `dsh-super-agent`（任意 CLI agent 的准入控制与信任阶梯）是姐妹件。

## 安装

插件市场（Settings → Plugin Market）或：

```sh
dsh plugin add dsh-agentdiary-plugin
```

## 配置

| 项 | 含义 | 默认 |
|---|---|---|
| `repo` | 日记 git 仓绝对路径 | —（为空时插件停用） |
| `node` | 本机在日记中的节点短名 | `dsh-host` |
| `commitEveryEntry` | 每条即 commit+push / 会话结束时 | `false` |

## 维护者验证清单

1. 用 `@deepseek-ai/dsh` 生成的 Cordis 目录核对 `session/event` 精确签名——全部缝隙集中在 `src/entry.ts`；
2. Node ≥22.22.3 真机冒烟：加载插件、跑一个会话、确认当日文件与提交；
3. dsh-plugin.org 提交：本仓公开并带 `dsh-plugin` topic；npm 发布在 (1)(2) 通过后。

## 许可证

MIT
