// dsh-agentdiary-plugin — agentdiary for DeepSeek Harness.
// "Your agents keep a diary — in your own git repo."
//
// This module is the CORDIS ADAPTER: it translates the harness's session/event stream
// (ctx.on('session/created' | 'session/event' | 'session/disposed') — event is the SECOND
// argument) into normalized RawSessionEvents and feeds DiaryCore. The engine itself lives
// in core.ts and knows nothing about Cordis — the same seam carries the OAR adapter
// (src/adapters/oar.ts, v0.3).
//
// `session/disposed` fires only when a session is DETACHED from the store — process
// teardown, not task completion (v0.1.0 keyed on it and never wrote a single entry).
// The diary keys on `turn/end`; disposal stays as a best-effort sweep for work
// interrupted mid-turn.

import type { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { appendEntry, commitDiary, type DiaryEntry } from "./diary.js";
import type { DiarySink } from "./core.js";
import { DiaryCore, MarkdownSink, summarize, assistantText, type TurnTally } from "./core.js";
import { TrajectorySink } from "./trajectory.js";

export { toEntry } from "./entry.js";
export { summarize, assistantText, type TurnTally } from "./core.js";

export const name = "dsh-agentdiary-plugin";

export const inject: readonly string[] = [];

export const Config = Schema.object({
  repo: Schema.string().default("").description("absolute path to the agentdiary git repo (empty = disabled)"),
  node: Schema.string().default("dsh-host").description("this machine's short name in the diary"),
  commitEveryEntry: Schema.boolean().default(true).description("commit+push after every diary entry"),
  trajectory: Schema.boolean().default(false).description("also write machine-readable JSONL trajectories (v0.4)"),
  extraSensitivePatterns: Schema.array(Schema.string()).description("extra regex patterns for the trajectory sensitive-scan (owner rules)"),
});

export interface Config {
  repo: string;
  node: string;
  commitEveryEntry: boolean;
  trajectory?: boolean;
  extraSensitivePatterns?: string[];
}

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger;
  if (!config.repo) {
    log.warn("agentdiary: config.repo empty — diary disabled");
    return;
  }
  const sink = new MarkdownSink(config.repo, config.node, config.commitEveryEntry, {
    info: (m) => log.info(`agentdiary: ${m}`),
    warn: (m) => log.warn(`agentdiary: ${m}`),
  });
  const sinks: DiarySink[] = [sink];
  if (config.trajectory) {
    sinks.push(new TrajectorySink({ root: config.repo, node: config.node, extraSensitivePatterns: config.extraSensitivePatterns ?? [], log: { info: (m) => log.info(`agentdiary: ${m}`), warn: (m) => log.warn(`agentdiary: ${m}`) } }));
  }
  const core = new DiaryCore({ node: config.node }, sinks);

  ctx.on("session/created" as never, ((session: { id?: unknown }) => {
    core.handle({ id: String(session?.id ?? "unknown"), phase: "created" });
  }) as never);

  ctx.on("session/event" as never, ((session: { id?: unknown }, event: { type?: unknown; data?: unknown }) => {
    // the harness wraps the typed payload in .data (v0.1.3 lesson); the flat fallback
    // keeps widened hosts working — core sees the unwrapped payload either way
    const p = (event?.data ?? event) as unknown;
    core.handle({
      id: String(session?.id ?? "unknown"),
      phase: "event",
      type: String(event?.type ?? "unknown"),
      data: p,
    });
  }) as never);

  ctx.on("session/disposed" as never, ((session: { id?: unknown }) => {
    core.handle({ id: String(session?.id ?? "unknown"), phase: "disposed" });
  }) as never);
}
