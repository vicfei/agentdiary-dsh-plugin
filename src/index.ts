// dsh-agentdiary-plugin — agentdiary for DeepSeek Harness.
// "Your agents keep a diary — in your own git repo."
//
// Contract (verified against dsh-loopx-plugin's observer, the reference implementation):
//   ctx.on('session/created',  session => ...)
//   ctx.on('session/event',   (session, event) => ...)   // event is the SECOND argument
//   ctx.on('session/disposed', session => ...)
// Diary semantics = task-level granularity: ONE entry per session (on disposal),
// summarizing the event mix; the per-event firehose belongs to the evidence ledger.

import type { Context } from "@deepseek-ai/cordis";
import { appendEntry, commitDiary, type DiaryEntry } from "./diary.js";

export const name = "dsh-agentdiary-plugin";

export const inject: readonly string[] = [];

export interface Config {
  /** Absolute path to the agentdiary git repository. */
  repo: string;
  /** This machine's short node name in the diary. */
  node: string;
  /** Commit+push after every session entry. */
  commitEveryEntry: boolean;
}

export const Config: Config = { repo: "", node: "dsh-host", commitEveryEntry: true } as unknown as Config;

interface SessionTally {
  id: string;
  startedAt: Date;
  kinds: Map<string, number>;
}

export function summarize(t: SessionTally): DiaryEntry {
  const total = [...t.kinds.values()].reduce((a, b) => a + b, 0);
  const top = [...t.kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k}×${n}`);
  const minutes = Math.max(1, Math.round((Date.now() - t.startedAt.getTime()) / 60000));
  return {
    at: new Date(),
    task: `DSH session ${t.id} settled`,
    did: top.length > 0 ? top : ["no session events observed"],
    result: `${total} events over ~${minutes} min`,
  };
}

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger;
  if (!config.repo) {
    log.warn("agentdiary: config.repo empty — diary disabled");
    return;
  }
  const open = new Map<string, SessionTally>();
  ctx.on("session/created" as never, ((session: { id?: unknown }) => {
    const id = String(session?.id ?? "unknown");
    open.set(id, { id, startedAt: new Date(), kinds: new Map() });
  }) as never);
  ctx.on("session/event" as never, ((session: { id?: unknown }, event: { type?: unknown }) => {
    const id = String(session?.id ?? "unknown");
    const t = open.get(id) ?? { id, startedAt: new Date(), kinds: new Map() };
    const kind = String(event?.type ?? "unknown");
    t.kinds.set(kind, (t.kinds.get(kind) ?? 0) + 1);
    open.set(id, t);
  }) as never);
  ctx.on("session/disposed" as never, ((session: { id?: unknown }) => {
    const id = String(session?.id ?? "unknown");
    const t = open.get(id);
    if (!t) return;
    open.delete(id);
    try {
      const file = appendEntry({ root: config.repo, node: config.node }, summarize(t));
      log.info(`agentdiary: session ${id} -> ${file}`);
      if (config.commitEveryEntry) commitDiary(config.repo, `diary: session ${id}`);
    } catch (e) {
      log.warn(`agentdiary: append failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }) as never);
}
