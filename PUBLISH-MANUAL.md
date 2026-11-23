# 手动发布 0.3.0 / 0.4.0（owner 操作，SG 节点）

## 准备（一次性）

```sh
cd ~/agentdiary-dsh-plugin
npm login --auth-type=web     # 你自己的 TTY 里交互正常；授权完成后 whoami 应输出 vicfei
npm whoami
```

## 发布两版

```sh
# 0.3.0（EventSource 接缝 + Cordis/OAR 双适配器）
git checkout 1b2092e0
npm publish                   # prepack 会自动构建；per-repo .npmrc 已钉 npmjs（无镜像坑）

# 0.4.0（JSONL 轨迹 + 敏感扫描）
git checkout main
npm publish

# 验证
npm view dsh-agentdiary-plugin versions
```

## 备选：在任何有 Node ≥20 的机器上

```sh
git clone https://github.com/vicfei/agentdiary-dsh-plugin && cd agentdiary-dsh-plugin
git checkout 1b2092e0 && npm ci && npm publish        # 0.3.0
git checkout main && npm ci && npm publish            # 0.4.0
```

注意：publish 需要 npmjs 账号的网页授权（本机 TTY 里 login 即可）；`.dsh`/node_modules 不会进包（files 字段已限定 dist）。
