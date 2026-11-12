// dsh-agentdiary-plugin — agentdiary for DeepSeek Harness.
// "Your agents keep a diary — in your own git repo."
//
// Subscribes to the durable session event stream (`session/event`, see
// docs/agent-lifecycle.md: "SDK users that need replayable transcript data should consume
// session/event") and appends one diary entry per settled session turn boundary — without
// leaving the machine: entries land in a local git repo you own.
//
// NOTE(integration-verify): exact Cordis event signatures live in the generated catalog of
// @deepseek-ai/dsh. This adapter keeps a deliberately thin seam (`toEntry`) so the catalog
// check is a one-file review. See README "Verification checklist".

import type { Context } from "@deepseek-ai/cordis";
import { appendEntry, commitDiary } from "./diary.ts";

export const name = "dsh-agentdiary-plugin";

export const inject = ["dsh"];

export interface Config {
  /** Absolute path to the agentdiary git repository. */
  repo: string;
  /** This machine's short node name in the diary (e.g. "laptop", "singapore"). */
  node: string;
  /** Commit+push after every entry (true) or only on session end (false). */
  commitEveryEntry: boolean;
}

export const Config: Config = { repo: "", node: "dsh-host", commitEveryEntry: false } as unknown as Config;

export { toEntry } from "./entry.ts";

export function apply(ctx: Context, config: Config): void {
  const log = ctx.logger;
  if (!config.repo) {
    log.warn("agentdiary: config.repo empty — diary disabled");
    return;
  }
  ctx.on(
    // Durable transcript stream per docs/agent-lifecycle.md; exact signature from the
    // generated Cordis catalog at load time.
    "session/event" as never,
    (ev: Record<string, unknown>) => {
      const entry = toEntry(config.node, ev);
      if (!entry) return;
      try {
        const file = appendEntry({ root: config.repo, node: config.node }, entry);
        log.info(`agentdiary: entry -> ${file}`);
        if (config.commitEveryEntry) commitDiary(config.repo, `diary: ${entry.task}`);
      } catch (e) {
        log.warn(`agentdiary: append failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } as never,
  );
}
