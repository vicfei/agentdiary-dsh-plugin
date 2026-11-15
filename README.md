# agentdiary for DeepSeek Harness

**Your agents keep a diary — in your own git repo.**

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that subscribes to the durable `session/event` stream and appends one diary entry per settled event into a local git repository you own:

```text
sessions/2026-11/2026-11-12-<node>.md   # append-only, one file per node per day
```

- **Git-native** — no server, no cloud, no lock-in; the repo is yours (GitHub/Gitea/bare, anything).
- **Zero-dependency core** — the diary writer is pure Node (`fs` + `git`).
- **Bilingual** display metadata (en/zh).

Sibling of the `agentdiary` CLI (personal agent diary across machines) and `dsh-super-agent` (admission control & trust ladder for any CLI agent).

## Install

From the plugin market (Settings → Plugin Market), or:

```sh
dsh plugin add dsh-agentdiary-plugin
```

## Configure

| Option | Meaning | Default |
|---|---|---|
| `repo` | absolute path to your diary git repo (created if missing) | — (plugin disabled when empty) |
| `node` | this machine's short name in the diary | `dsh-host` |
| `commitEveryEntry` | commit+push after every entry vs on session end | `false` |

## Verification checklist (maintainer)

1. ~~Exact `session/event` Cordis signature~~ **RESOLVED 2026-11-12** (verified against dsh-loopx-plugin observer + live boot): `ctx.on('session/event', (session, event))` — event is the SECOND arg; `inject: []`; `Config` must be a schemastery `Schema.object`; profile layer requires a `dsh.bundle.patch` manifest. Both entries activate clean in a headless boot.
2. Live smoke under Node ≥22.22.3: load plugin, run one session, check the day file appears and commits.
3. dsh-plugin.org submission: this repo is public with the `dsh-plugin` topic; npm publish after (1)+(2) pass.

## License

MIT
