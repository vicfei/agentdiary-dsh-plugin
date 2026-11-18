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
  /** P1 rich entries: tool-call names by count, and the assistant's last spoken text. */
  tools: Map<string, number>;
  lastText: string;
  /** Active-duration accounting (0.2.1): wall-clock time between events, each gap capped —
   *  a turn that sat 160 min waiting on a human approval reads ~15 min, not ~164 (win11 smoke). */
  activeMs: number;
  lastEventAt: number;
}

/** turn/end reasons that mean "this task attempt settled" — the rest are
 *  bookkeeping closers (interrupted/forked) or may be retried (blocked). */
const SETTLED = new Set(["completed", "error", "max-tokens", "aborted"]);

/** turn/end reasons we deliberately do not diary, without warning. */
const QUIET = new Set(["blocked", "interrupted", "forked", ""]);

/** How much of the assistant's closing text the diary quotes (P1: pure extraction,
 *  no model calls — the quote is what the agent SAID, verbatim, tail-kept). */
const QUOTE_MAX = 160;

/** Any silent gap longer than this counts as waiting (approval, human, lunch), not work. */
const IDLE_GAP_CAP_MS = 15 * 60_000;

export { toEntry } from "./entry.js";

export function summarize(t: TurnTally, label: string): DiaryEntry {
  const total = [...t.kinds.values()].reduce((a, b) => a + b, 0);
  const top = [...t.kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}×${n}`);
  const minutes = Math.max(1, Math.round(t.activeMs / 60000));
  const did: string[] = [];
  // what it did, in descending order of workiness: tools first, then event mix, then its own words
  if (t.tools.size > 0) {
    const tools = [...t.tools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}×${n}`).join(" · ");
    did.push(`tools: ${tools}`);
  }
  if (top.length > 0) did.push(top.join(" · "));
  if (t.lastText) did.push(`said: “${t.lastText}”`);
  return {
    at: new Date(),
    task: `DSH session ${t.id.slice(0, 12)} ${label}`,
    did: did.length > 0 ? did.slice(0, 6) : ["no session events observed"],
    result: `${total} events over ~${minutes} min`,
  };
}

/** Pull the plain text out of an assistant message's content blocks
 *  (ContentBlock union: text blocks are { type: 'text', text }). */
export function assistantText(data: unknown): string {
  const blocks = (data as { message?: { content?: unknown[] } })?.message?.content;
  if (!Array.isArray(blocks)) return "";
  const text = blocks
    .filter((b): b is { type: "text"; text: string } => (b as { type?: string })?.type === "text")
    .map((b) => String(b.text ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > QUOTE_MAX ? `…${text.slice(text.length - QUOTE_MAX + 1)}` : text;
}

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger;
  if (!config.repo) {
    log.warn("agentdiary: config.repo empty — diary disabled");
    return;
  }
  const open = new Map<string, TurnTally>();
  const fresh = (id: string): TurnTally => {
    const now = Date.now();
    return { id, startedAt: new Date(now), kinds: new Map(), tools: new Map(), lastText: "", activeMs: 0, lastEventAt: now };
  };

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

  ctx.on("session/event" as never, ((session: { id?: unknown }, event: { type?: unknown; data?: { reason?: { kind?: unknown }; turn?: unknown; name?: unknown } }) => {
    const id = String(session?.id ?? "unknown");
    const t = open.get(id) ?? fresh(id);
    const now = Date.now();
    t.activeMs += Math.min(now - t.lastEventAt, IDLE_GAP_CAP_MS);
    t.lastEventAt = now;
    const type = String(event?.type ?? "unknown");
    t.kinds.set(type, (t.kinds.get(type) ?? 0) + 1);
    const p = event?.data ?? event; // the harness wraps the typed payload in .data
    const toolName = (p as { name?: unknown })?.name; // flat-dispatch compat keeps this a widened read
    if (type === "tool/call" && typeof toolName === "string") t.tools.set(toolName, (t.tools.get(toolName) ?? 0) + 1);
    if (type === "assistant/message") {
      const spoken = assistantText(p);
      if (spoken) t.lastText = spoken; // the LAST thing it said is the settlement's own account
    }
    open.set(id, t);
    if (type !== "turn/end") return;
    // p already unwraps event.data (flat fallback) — see its declaration above.
    const kind = String((p as { reason?: { kind?: unknown } })?.reason?.kind ?? "");
    if (!SETTLED.has(kind)) {
      // blocked/interrupted/forked: known-quiet — keep the tally, the work surfaces with the
      // next settled turn. Anything else is a contract surprise: say so instead of silently
      // dropping the turn (live lesson: one silent mismatch cost a smoke round-trip).
      if (!QUIET.has(kind)) log.warn(`agentdiary: turn/end with unrecognized reason.kind=${JSON.stringify(kind)} — no diary entry written`);
      return;
    }
    const label = `turn ${String((p as { turn?: unknown })?.turn ?? "?")} ${kind}`;
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
