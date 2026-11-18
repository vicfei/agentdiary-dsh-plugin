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
import Schema from "@deepseek-ai/schemastery";
import { appendEntry, commitDiary } from "./diary.js";
export const name = "dsh-agentdiary-plugin";
export const inject = [];
export const Config = Schema.object({
    repo: Schema.string().default("").description("absolute path to the agentdiary git repo (empty = disabled)"),
    node: Schema.string().default("dsh-host").description("this machine's short name in the diary"),
    commitEveryEntry: Schema.boolean().default(true).description("commit+push after every diary entry"),
});
/** turn/end reasons that mean "this task attempt settled" — the rest are
 *  bookkeeping closers (interrupted/forked) or may be retried (blocked). */
const SETTLED = new Set(["completed", "error", "max-tokens", "aborted"]);
export { toEntry } from "./entry.js";
export function summarize(t, label) {
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
export function apply(ctx, config) {
    const log = ctx.logger;
    if (!config.repo) {
        log.warn("agentdiary: config.repo empty — diary disabled");
        return;
    }
    const open = new Map();
    const fresh = (id) => ({ id, startedAt: new Date(), kinds: new Map() });
    const write = (t, label) => {
        try {
            const file = appendEntry({ root: config.repo, node: config.node }, summarize(t, label));
            log.info(`agentdiary: ${label} -> ${file}`);
            if (config.commitEveryEntry)
                commitDiary(config.repo, `diary: session ${t.id.slice(0, 12)} ${label}`);
        }
        catch (e) {
            log.warn(`agentdiary: append failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    };
    ctx.on("session/created", ((session) => {
        open.set(String(session?.id ?? "unknown"), fresh(String(session?.id ?? "unknown")));
    }));
    ctx.on("session/event", ((session, event) => {
        const id = String(session?.id ?? "unknown");
        const t = open.get(id) ?? fresh(id);
        const type = String(event?.type ?? "unknown");
        t.kinds.set(type, (t.kinds.get(type) ?? 0) + 1);
        open.set(id, t);
        if (type !== "turn/end")
            return;
        const kind = String(event?.reason?.kind ?? "");
        if (!SETTLED.has(kind))
            return; // blocked/interrupted/forked: keep the tally — the work
        // stays on the books and surfaces with the next settled turn (never dropped)
        const label = `turn ${String(event?.turn ?? "?")} ${kind}`;
        write(t, label);
        open.set(id, fresh(id));
    }));
    ctx.on("session/disposed", ((session) => {
        const id = String(session?.id ?? "unknown");
        const t = open.get(id);
        if (!t)
            return;
        open.delete(id);
        // Teardown mid-turn: the events counted so far never got their turn/end —
        // they deserve a line, clearly labeled as a teardown rather than a settlement.
        if ([...t.kinds.values()].reduce((a, b) => a + b, 0) > 0)
            write(t, "session torn down mid-turn");
    }));
}
//# sourceMappingURL=index.js.map