# agentdiary for DeepSeek Harness

**Your agents keep a diary — in your own git repo.**

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that subscribes to the durable `session/event` stream and appends one diary entry per settled **turn** into a local git repository you own:

```text
sessions/2026-11/2026-11-12-<node>.md   # append-only, one file per node per day
```

- **Git-native** — no server, no cloud, no lock-in; the repo is yours (GitHub/Gitea/bare, anything).
- **Zero-dependency core** — the diary writer is pure Node (`fs` + `git`).
- **Bilingual** display metadata (en/zh).

Sibling of the `agentdiary` CLI (personal agent diary across machines) and `dsh-super-agent` (admission control & trust ladder for any CLI agent).

## When a diary entry appears

One entry per **settled turn** — when the harness emits `turn/end` with reason `completed`, `error`, `max-tokens`, or `aborted`. Since 0.2.0 the entry is **rich** (pure extraction, no model calls): the tool mix (`tools: bash×3 · edit×1`), the event mix, and the agent's own closing words, tail-quoted (`said: "…all 12 tests pass now."`), plus the duration and how it ended.

Reasons you will *not* see as entries: `blocked` (retried as a new turn), `interrupted`/`forked` (bookkeeping closers) — their events stay on the books and surface with the next settled turn, never dropped.

> **Why not one entry per session?** v0.1.0 keyed on `session/disposed` and never wrote a single entry: in the harness (`packages/core/session`), disposal fires only when a session is **detached from the store** — typically app shutdown — not when a task completes or is archived. v0.1.1 keys on turn settlement; disposal remains as a best-effort sweep ("session torn down mid-turn") so interrupted work still gets a line.

## Install

From the plugin market (Settings → Plugin Market), or:

```sh
dsh plugin --profile web add dsh-agentdiary-plugin
```

**Deployment notes** (learned the hard way on live nodes):

- The web app runs the **web profile** — a plain `dsh plugin add` installs into `default` and never loads. Use `--profile web` (or install from the market inside the web UI, which targets the right profile).
- Port 3080 is often taken; start with `dsh web --port <n>` instead of hunting ghosts.
- Node ≥ 22.22.3 / 24 (the harness's own engines floor).

## Configure

| Option | Meaning | Default |
|---|---|---|
| `repo` | absolute path to your diary git repo (created if missing) | — (plugin disabled when empty) |
| `node` | this machine's short name in the diary | `dsh-host` |
| `commitEveryEntry` | commit+push after every entry vs on session end | `true` |
| `trajectory` | also write machine-readable JSONL trajectories (v0.4) | `false` |
| `extraSensitivePatterns` | extra regex patterns for the trajectory sensitive-scan | — |

## Verification checklist (maintainer)

1. ~~Exact `session/event` Cordis signature~~ **RESOLVED 2026-11-12** (verified against dsh-loopx-plugin observer + live boot): `ctx.on('session/event', (session, event))` — event is the SECOND arg; `inject: []`; `Config` must be a schemastery `Schema.object`; profile layer requires a `dsh.bundle.patch` manifest. Both entries activate clean in a headless boot.
2. ~~Live smoke~~ **PASSED 2026-11-18 with 0.1.3** (win11, real web turn): the day file gains a `turn N completed` entry with the event mix, `commitEveryEntry` commits land on the chain, zero warnings. Three-round convergence to get here: 0.1.0 keyed on `session/disposed` (store-detach only — see above); 0.1.1 shipped a stale `lib/` (publish now runs `prepack`); 0.1.2 read `turn`/`reason` flat but the harness wraps them in `event.data` (`SessionEvent = { type, seq, time, data }`); 0.1.3 unwraps with a flat fallback and warns on unknown `reason.kind`.
3. **dsh-plugin.org — indexed by mechanism (2026-11-23):** the hub scans the `dsh-plugin` topic automatically and this repo is public with the topic + npm live; conditions met by design. Remaining: eyeball the listing at dsh-plugin.org (the index is 27,503 plugins and JS-rendered) and let the community review assign the category/compatibility labels.

## Trajectories (v0.4)

With `trajectory: true`, every settled turn ALSO lands one JSONL line at
`trajectories/YYYY-MM/DD-node.jsonl` — tools by name and count, the event mix, active
duration, the tail quote, the outcome, and token usage when the host reports it. This is
the capture layer the thin-agent distillation plan named ("audit.jsonl ≈ 90% of a
trajectory recorder"): structured, greppable, owned by the same append-only git repo.

Every line passes the **sensitive-scan** first — seven built-in families (GitHub PAT,
`sk-` keys, npm tokens, AWS keys, private-key blocks, JWTs, the corporate-domain family
from the 11-18 lesson) plus owner regexes — and warns with kinds and counts, **never
echoing content, never blocking** (zero-redaction stands for private repos; exports get
a review reminder).

## Adapters (v0.3)

The diary engine (`core.ts`) is host-agnostic: adapters normalize a harness's event
stream into it, and every adapter rides the same rich-entry pipeline.

- **Cordis** (`index.ts`) — DeepSeek Harness, the original.
- **OAR** (`src/adapters/oar.ts`) — [Open Agent Runtime](https://github.com/botiverse/oar)
  (~15 harnesses behind one programming interface, a *library not a protocol*).
  Zero-dependency: the host owns the OAR session and hands it in duck-typed; the mapping
  is probed against oar's `docs/spec/record-stream.md` (`tool_call_started` → tool/call,
  `text_delta` accumulated into the tail quote, `turn_ended` → settlement, lifecycle
  records → the teardown sweep).

**Why this matters for a fleet:** zcode/claude/codex sessions can write into the same
diary — coverage follows the multi-harness reality with zero engine change.

**Why the diary survives compaction.** Long-task field reports name *retention inversion*:
harness compaction silently drops governance constraints that lived only in the context.
The diary is the counterweight — an append-only, git-native record of what was done and
said, re-readable after the context is gone.

## License

MIT
