# agentdiary · DeepSeek Harness 版

**你的 agent 写日记——写在你自己的 git 仓里。**

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 插件：订阅持久的 `session/event` 事件流，把每个**落定的回合（turn）**追加为你自己 git 仓里的日记条目：

```text
sessions/2026-11/2026-11-12-<节点名>.md   # 只追加，每节点每日一文件
```

- **git 原生**——无服务器、无云、无锁定，仓是你的；
- **零依赖核心**——日记写入器是纯 Node（`fs` + `git`）；
- **双语**显示元数据（en/zh）。

与 `agentdiary` CLI（跨机个人 agent 日记）和 `dsh-super-agent`（任意 CLI agent 的准入控制与信任阶梯）是姐妹件。

## 什么时候写一条日记

每个**落定回合**写一条——harness 发出 `turn/end` 且原因为 `completed` / `error` / `max-tokens` / `aborted` 时。0.2.0 起条目是**富条目**（纯截取，零模型调用）：工具构成（`tools: bash×3 · edit×1`）、事件构成、以及 agent 自己的收尾原话（尾部引用 `said: "…12 个测试全过。"`），外加耗时与结束方式。

不会写成条目的原因：`blocked`（会作为新回合重试）、`interrupted`/`forked`（记账性收尾）——它们的事件留在账上，随下一个落定回合一并呈现，绝不丢弃。

> **为什么不是每会话一条？** v0.1.0 挂在 `session/disposed` 上，结果一条都没写成：harness 源码（`packages/core/session`）里，disposed 只在会话从 store **分离**时触发——通常是应用关停，而不是任务完成/归档时。v0.1.1 改挂在回合落定上；disposed 降级为兜底清扫（"session torn down mid-turn"），被打断的工作也有一行记录。

## 安装

插件市场（Settings → Plugin Market）或：

```sh
dsh plugin --profile web add dsh-agentdiary-plugin
```

**部署注意事项**（真机踩坑得来）：

- web 应用跑在 **web profile** 上——直接 `dsh plugin add` 装进 `default`，永远不加载。用 `--profile web`（或在 web UI 的插件市场里装，它自动对准 profile）；
- 3080 端口常被占用，用 `dsh web --port <n>` 起服务；
- Node ≥ 22.22.3 / 24（harness 自身的 engines 下限）。

## 配置

| 项 | 含义 | 默认 |
|---|---|---|
| `repo` | 日记 git 仓绝对路径 | —（为空时插件停用） |
| `node` | 本机在日记中的节点短名 | `dsh-host` |
| `commitEveryEntry` | 每条即 commit+push / 会话结束时 | `true` |

## 维护者验证清单

1. ~~`session/event` 精确签名~~ **2026-11-12 已解决**：`ctx.on('session/event', (session, event))`——event 是第二个参数；`inject: []`；`Config` 用 schemastery `Schema.object`；profile 层需要 `dsh.bundle.patch` manifest。
2. ~~真机冒烟~~ **2026-11-18 以 0.1.3 通过**（win11，真实 web 回合）：当日文件出现 `turn N completed` 条目带事件构成，commitEveryEntry 提交在链，零告警。三轮收敛史：0.1.0 挂 disposed（仅 store 分离）；0.1.1 发了陈旧 lib/（现已 prepack 强制重建）；0.1.2 平读 turn/reason 但宿主包在 `event.data` 里（`SessionEvent = { type, seq, time, data }`）；0.1.3 解包 + 扁平兼容 + 未知 kind 告警。
3. dsh-plugin.org 提交：本仓公开并带 `dsh-plugin` topic；npm 0.1.3 已上线；0.2.0 增加富条目（工具 + 收尾原话引用）。

## 轨迹(v0.4)

开启 `trajectory: true` 后,每个结算 turn 还会落一行 JSONL 到 `trajectories/YYYY-MM/DD-node.jsonl`——工具按名与次数、事件构成、活跃时长、尾引、结果,宿主上报时含 token 用量。这就是 thin-agent 蒸馏方案点名的那个采集层("audit.jsonl ≈ 轨迹记录器九成现成"):结构化、可 grep、与日记同一个 append-only git 仓。

每行先过**敏感扫描**——七个内建家族(GitHub PAT、`sk-` 密钥、npm token、AWS key、私钥块、JWT、11-18 教训里的公司域家族)加 owner 自定义正则——以种类与次数告警,**不回显内容、不阻断**(私有仓零脱敏裁定照旧;导出前请复核)。

## 适配器(v0.3)

日记引擎(`core.ts`)与宿主无关:适配器把各 harness 的事件流归一化喂给它,共用同一套富条目管线。

- **Cordis**(`index.ts`)——DeepSeek Harness,元祖。
- **OAR**(`src/adapters/oar.ts`)——[Open Agent Runtime](https://github.com/botiverse/oar)(约 15 个 coding-agent runtime 共享一个编程接口,定位是**库不是协议**)。零依赖:宿主持有 OAR session、以鸭子类型传入;映射按 oar 的 `docs/spec/record-stream.md` 实测(`tool_call_started`→tool/call、`text_delta` 累积成尾引、`turn_ended`→结算、生命周期记录→收尾扫除)。

**对 fleet 的意义**:zcode/claude/codex 的会话写进同一本日记——覆盖面跟随多 harness 现实,引擎零改动。

**为什么日记扛得住 compaction。** 长任务实战报告命名了*保留倒置*:harness 压缩会静默丢掉只活在上下文里的治理约束。日记是对重——append-only、git 原生、记录做过什么与说过什么,上下文没了也能重读。

## 许可证

MIT
