# agentdiary-plugin Roadmap（2026-11-23 定）

> 定位：你的 agent 在你自己的 git 仓里写日记——DeepSeek Harness 的 `session/event` 订阅者，每结算 turn 一条富条目。当前 0.2.1 live（富条目+时长语义修复，win11 真机冒烟三轮收敛闭环）。
> 排序原则：分发零成本先行 → 覆盖面跟上 fleet 的多 harness 现实 → 蒸馏数据战略 → 机会型接线。

## P0 — 分发（零代码，立即可做）

- [ ] **dsh-plugin.org 投递**（README 核对单最后一项开放项）：条件已全满足——公开仓 + `dsh-plugin` topic + npm live（0.2.1）；投递文案随市场 listing 一起打磨（一句定位+一张示例条目截图）。

## P1 — 跨 harness 适配层（v0.3，OAR 适配器）

现状分层已经天然支持：`diary.ts`（writer，harness 无关）与 `index.ts`（164 行 Cordis 订阅胶水）分立。

- [ ] 抽 `EventSource` 接口：`subscribe(onEntry: (ev) => void): Promise<void>`——Cordis 为第一实现，**OAR（Open Agent Runtime，566★，15 harness 统一接口，DSH 在采用名单）为第二实现**。
- [ ] evidence-plugin 同构改造（两插件共享同一 EventSource 合约）。
- 拧劲：日记覆盖面随 harness 生态扩张而**引擎零改动**——zcode/claude/codex 的会话写进同一本日记，正是 fleet 的多 harness 现实；OAR 适配器即 v1.8 扫描 C1 判定的 P1 项。
- 测试：index.test.ts 拆 Cordis/OAR 两 suite，writer 共享。

## P2 — 机器可读轨迹（v0.4，蒸馏数据战略）

- [ ] 新输出 `trajectories/YYYY-MM/DD-node.jsonl`：每结算 turn 一行结构化记录（tools 全量、入参摘要、结束原因、时长、token 数——$DSH_USAGE_FILE 存在时）。md 日记保持人读形态不动。
- 拧劲：这是 **thin-agent 蒸馏方案点名的缺口**（wsl2 11-22："audit.jsonl+session 状态 ≈ 轨迹记录器九成现成"）——轨迹是 worker 自己 git 仓里的资产，蒸馏数据采集与证据同管线、同一 append-only 纪律。
- 隐私闸门：`sensitive-scan` 对 JSONL 导出默认开启（公司域名/密钥样字符串 → warn 不阻断；Push Protection 的 11-16/11-18 两次实测教训）。md 文件维持现状（owner 零脱敏裁定适用于舰队仓，公开仓由平台闸兜底）。

## P3 — 生态接线（机会型，随宿主演进）

- [ ] **预算联动**：条目加 `tokens:` 行（$DSH_USAGE_FILE 存在时；dsh-super-agent v1.11 的 usage 协议）——日记即预算台账的人读面。
- [ ] **周报桥**：CLI `agentdiary week` 合并节点周窗，作 reports 引擎第三数据源（sessionlog/worklog 之外的事实层）。
- [ ] **retention 反证叙事**：长任务的 diary 是 compaction 之后可重读的 append-only 记录——与 dsh-compaction-semantic 的"约束丢失"问题互补（README 论证段）。

## 验收节奏

每期一个小版本（0.3 / 0.4），win11 真机冒烟为准（与 singapore 发布交替，0.1.x→0.2.x 的既有节奏）；npm 发布沿用 prepack + per-repo .npmrc + 网页授权流程。
