// dsh-agentdiary-plugin — agentdiary for DeepSeek Harness.
// "Your agents keep a diary — in your own git repo."
//
// Contract (verified against dsh-loopx-plugin's observer, the reference implementation):
//   ctx.on('session/created',  session => ...)
//   ctx.on('session/event',   (session, event) => ...)   // event is the SECOND argument
//   ctx.on('session/disposed', session => ...)
// Diary semantics = task-level granularity: ONE entry per session (on disposal),
// summarizing the event mix; the per-event firehose belongs to the evidence ledger.
import Schema from "@deepseek-ai/schemastery";
import { appendEntry, commitDiary } from "./diary.js";
export const name = "dsh-agentdiary-plugin";
export const inject = [];
export const Config = Schema.object({
    repo: Schema.string().default("").description("absolute path to the agentdiary git repo (empty = disabled)"),
    node: Schema.string().default("dsh-host").description("this machine's short name in the diary"),
    commitEveryEntry: Schema.boolean().default(true).description("commit+push after every session entry"),
});
export { toEntry } from "./entry.js";
export function summarize(t) {
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
export function apply(ctx, config) {
    const log = ctx.logger;
    if (!config.repo) {
        log.warn("agentdiary: config.repo empty — diary disabled");
        return;
    }
    const open = new Map();
    ctx.on("session/created", ((session) => {
        const id = String(session?.id ?? "unknown");
        open.set(id, { id, startedAt: new Date(), kinds: new Map() });
    }));
    ctx.on("session/event", ((session, event) => {
        const id = String(session?.id ?? "unknown");
        const t = open.get(id) ?? { id, startedAt: new Date(), kinds: new Map() };
        const kind = String(event?.type ?? "unknown");
        t.kinds.set(kind, (t.kinds.get(kind) ?? 0) + 1);
        open.set(id, t);
    }));
    ctx.on("session/disposed", ((session) => {
        const id = String(session?.id ?? "unknown");
        const t = open.get(id);
        if (!t)
            return;
        open.delete(id);
        try {
            const file = appendEntry({ root: config.repo, node: config.node }, summarize(t));
            log.info(`agentdiary: session ${id} -> ${file}`);
            if (config.commitEveryEntry)
                commitDiary(config.repo, `diary: session ${id}`);
        }
        catch (e) {
            log.warn(`agentdiary: append failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    }));
}
//# sourceMappingURL=index.js.map