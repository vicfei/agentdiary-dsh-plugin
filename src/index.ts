// dsh-agentdiary-plugin — agentdiary for DeepSeek Harness.
// "Your agents keep a diary — in your own git repo."
//
// Contract (verified against the harness source, packages/core/session):
//   ctx.on('session/created',  session => ...)
//   ctx.on('session/event',   (session, event) => ...)   // event is the SECOND argument
//   ctx.on('session/disposed', session => ...)
// `session/disposed` fires only when a session is DETACHED from the store —
// process teardown, not task completion (a completed/archived session stays in
// the store; v0.1.0 keyed on it and never wrote a single entry). v0.1.1 keys
// the diary on `turn/end` instead: one entry per settled turn. Disposal stays
// as a best-effort sweep for work interrupted mid-turn.

import type { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { appendEntry, commitDiary, type DiaryEntry } from "./diary.js";

export const name = "dsh-agentdiary-plugin";

export const inject: readonly string[] = [];

export const Config = Schema.object({
  repo: Schema.string().default("").description("absolute path to the agentdiary git repo (empty = disabled)"),
  node: Schema.string().default("dsh-host").description("this machine's short name in the diary"),
  commitEveryEntry: Schema.boolean().default(true).description("commit+push after every diary entry"),
});

export interface Config {
  repo: string;
  node: string;
  commitEveryEntry: boolean;
}

/** One open tally per session — counts events since the last settled turn. */
interface TurnTally {
  id: string;
  startedAt: Date;
  kinds: Map<string, number>;
}

/** turn/end reasons that mean "this task attempt settled" — the rest are
 *  bookkeeping closers (interrupted/forked) or may be retried (blocked). */
const SETTLED = new Set(["completed", "error", "max-tokens", "aborted"]);

/** turn/end reasons we deliberately do not diary, without warning. */
const QUIET = new Set(["blocked", "interrupted", "forked", ""]);

export { toEntry } from "./entry.js";

export function summarize(t: TurnTally, label: string): DiaryEntry {
  const total = [...t.kinds.values()].reduce((a, b) => a + b, 0);
  const top = [...t.kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k}×${n}`);
  const minutes = Math.max(1, Math.round((Date.now() - t.startedAt.getTime()) / 60000));
  return {
    at: new Date(),
    task: `DSH session ${t.id.slice(0, 12)} ${label}`,
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
  const open = new Map<string, TurnTally>();
  const fresh = (id: string): TurnTally => ({ id, startedAt: new Date(), kinds: new Map() });

  const write = (t: TurnTally, label: string): void => {
    try {
      const file = appendEntry({ root: config.repo, node: config.node }, summarize(t, label));
      log.info(`agentdiary: ${label} -> ${file}`);
      if (config.commitEveryEntry) commitDiary(config.repo, `diary: session ${t.id.slice(0, 12)} ${label}`);
    } catch (e) {
      log.warn(`agentdiary: append failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  ctx.on("session/created" as never, ((session: { id?: unknown }) => {
    open.set(String(session?.id ?? "unknown"), fresh(String(session?.id ?? "unknown")));
  }) as never);

  ctx.on("session/event" as never, ((session: { id?: unknown }, event: { type?: unknown; data?: { reason?: { kind?: unknown }; turn?: unknown }; reason?: { kind?: unknown }; turn?: unknown }) => {
    const id = String(session?.id ?? "unknown");
    const t = open.get(id) ?? fresh(id);
    const type = String(event?.type ?? "unknown");
    t.kinds.set(type, (t.kinds.get(type) ?? 0) + 1);
    open.set(id, t);
    if (type !== "turn/end") return;
    // The harness wraps the typed payload in `event.data` (SessionEvent = { type, seq,
    // time, data: SessionEventMap[K] } — packages/core/session/src/types.ts). Read through
    // the wrapper, falling back to the flat shape so either dispatch survives.
    const p = event?.data ?? event;
    const kind = String(p?.reason?.kind ?? "");
    if (!SETTLED.has(kind)) {
      // blocked/interrupted/forked: known-quiet — keep the tally, the work surfaces with the
      // next settled turn. Anything else is a contract surprise: say so instead of silently
      // dropping the turn (live lesson: one silent mismatch cost a smoke round-trip).
      if (!QUIET.has(kind)) log.warn(`agentdiary: turn/end with unrecognized reason.kind=${JSON.stringify(kind)} — no diary entry written`);
      return;
    }
    const label = `turn ${String(p?.turn ?? "?")} ${kind}`;
    write(t, label);
    open.set(id, fresh(id));
  }) as never);

  ctx.on("session/disposed" as never, ((session: { id?: unknown }) => {
    const id = String(session?.id ?? "unknown");
    const t = open.get(id);
    if (!t) return;
    open.delete(id);
    // Teardown mid-turn: the events counted so far never got their turn/end —
    // they deserve a line, clearly labeled as a teardown rather than a settlement.
    if ([...t.kinds.values()].reduce((a, b) => a + b, 0) > 0) write(t, "session torn down mid-turn");
  }) as never);
}
