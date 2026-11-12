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
import { appendEntry, commitDiary } from "./diary.js";
import { toEntry } from "./entry.js";
export const name = "dsh-agentdiary-plugin";
export const inject = ["dsh"];
export const Config = { repo: "", node: "dsh-host", commitEveryEntry: false };
// re-exported below
export { toEntry };
export function apply(ctx, config) {
    const log = ctx.logger;
    if (!config.repo) {
        log.warn("agentdiary: config.repo empty — diary disabled");
        return;
    }
    ctx.on(
    // Durable transcript stream per docs/agent-lifecycle.md; exact signature from the
    // generated Cordis catalog at load time.
    "session/event", ((ev) => {
        const entry = toEntry(config.node, ev);
        if (!entry)
            return;
        try {
            const file = appendEntry({ root: config.repo, node: config.node }, entry);
            log.info(`agentdiary: entry -> ${file}`);
            if (config.commitEveryEntry)
                commitDiary(config.repo, `diary: ${entry.task}`);
        }
        catch (e) {
            log.warn(`agentdiary: append failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }));
}
//# sourceMappingURL=index.js.map