// DiaryCore — the harness-agnostic diary engine (v0.3 P1, EventSource seam).
// Receives normalized session events, keeps one tally per session, and hands settled
// turns to sinks (markdown diary, JSONL trajectory, …). Knows nothing about Cordis,
// OAR, or any host — adapters normalize their host's stream into RawSessionEvent.
import { appendEntry, commitDiary } from "./diary.js";
/** turn/end reasons that mean "this task attempt settled" — the rest are
 *  bookkeeping closers (interrupted/forked) or may be retried (blocked). */
export const SETTLED = new Set(["completed", "error", "max-tokens", "aborted"]);
/** turn/end reasons we deliberately do not diary, without warning. */
export const QUIET = new Set(["blocked", "interrupted", "forked", ""]);
/** How much of the assistant's closing text the diary quotes (pure extraction,
 *  no model calls — the quote is what the agent SAID, verbatim, tail-kept). */
export const QUOTE_MAX = 160;
/** Any silent gap longer than this counts as waiting (approval, human, lunch), not work. */
export const IDLE_GAP_CAP_MS = 15 * 60_000;
export function summarize(t, label) {
    const total = [...t.kinds.values()].reduce((a, b) => a + b, 0);
    const top = [...t.kinds.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k}×${n}`);
    const minutes = Math.max(1, Math.round(t.activeMs / 60000));
    const did = [];
    if (t.tools.size > 0) {
        const tools = [...t.tools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k}×${n}`).join(" · ");
        did.push(`tools: ${tools}`);
    }
    if (top.length > 0)
        did.push(top.join(" · "));
    if (t.lastText)
        did.push(`said: “${t.lastText}”`);
    if (t.usage)
        did.push(`tokens: in ${t.usage.input} · out ${t.usage.output}`);
    return {
        at: new Date(),
        task: `DSH session ${t.id.slice(0, 12)} ${label}`,
        did: did.length > 0 ? did.slice(0, 6) : ["no session events observed"],
        result: `${total} events over ~${minutes} min`,
    };
}
/** Pull the plain text out of an assistant message's content blocks
 *  (ContentBlock union: text blocks are { type: 'text', text }). */
export function assistantText(data) {
    const blocks = data?.message?.content;
    if (!Array.isArray(blocks))
        return "";
    const text = blocks
        .filter((b) => b?.type === "text")
        .map((b) => String(b.text ?? ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    return text.length > QUOTE_MAX ? `…${text.slice(text.length - QUOTE_MAX + 1)}` : text;
}
export class DiaryCore {
    opts;
    sinks;
    open = new Map();
    constructor(opts, sinks) {
        this.opts = opts;
        this.sinks = sinks;
    }
    fresh(id) {
        const now = Date.now();
        return { id, startedAt: new Date(now), kinds: new Map(), tools: new Map(), lastText: "", activeMs: 0, lastEventAt: now };
    }
    write(t, label) {
        const entry = summarize(t, label);
        for (const s of this.sinks) {
            try {
                s.onEntry(entry, label, t);
            }
            catch (e) {
                s.onWarn(`append failed: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
    /** The one entry point adapters feed. */
    handle(e) {
        const id = String(e.id ?? "unknown");
        if (e.phase === "created") {
            this.open.set(id, this.fresh(id));
            return;
        }
        if (e.phase === "disposed") {
            const t = this.open.get(id);
            if (!t)
                return;
            this.open.delete(id);
            // Teardown mid-turn: the events counted so far never got their turn/end —
            // they deserve a line, clearly labeled as a teardown rather than a settlement.
            if ([...t.kinds.values()].reduce((a, b) => a + b, 0) > 0)
                this.write(t, "session torn down mid-turn");
            return;
        }
        const t = this.open.get(id) ?? this.fresh(id);
        const now = Date.now();
        t.activeMs += Math.min(now - t.lastEventAt, IDLE_GAP_CAP_MS);
        t.lastEventAt = now;
        const type = String(e.type ?? "unknown");
        t.kinds.set(type, (t.kinds.get(type) ?? 0) + 1);
        const p = e.data;
        const toolName = p?.name;
        if (type === "tool/call" && typeof toolName === "string")
            t.tools.set(toolName, (t.tools.get(toolName) ?? 0) + 1);
        const u = p?.usage;
        if (u && typeof u === "object") {
            const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
            const input = num(u.input) ?? num(u.prompt_tokens);
            const output = num(u.output) ?? num(u.completion_tokens);
            if (input !== undefined || output !== undefined)
                t.usage = { input: input ?? 0, output: output ?? 0 };
        }
        if (type === "assistant/message") {
            const spoken = assistantText(p);
            if (spoken)
                t.lastText = spoken;
        }
        this.open.set(id, t);
        if (type !== "turn/end")
            return;
        const kind = String(p?.reason?.kind ?? "");
        if (!SETTLED.has(kind)) {
            if (!QUIET.has(kind))
                this.sinks.forEach((s) => s.onWarn(`turn/end with unrecognized reason.kind=${JSON.stringify(kind)} — no diary entry written`));
            return;
        }
        const label = `turn ${String(p?.turn ?? "?")} ${kind}`;
        this.write(t, label);
        this.open.set(id, this.fresh(id));
    }
}
/** The markdown-diary sink: append + commit, the plugin's original behavior. */
export class MarkdownSink {
    root;
    node;
    commitEveryEntry;
    log;
    constructor(root, node, commitEveryEntry, log) {
        this.root = root;
        this.node = node;
        this.commitEveryEntry = commitEveryEntry;
        this.log = log;
    }
    onEntry(entry, label, tally) {
        const file = appendEntry({ root: this.root, node: this.node }, entry);
        this.log.info(`-> ${file}`);
        if (this.commitEveryEntry)
            commitDiary(this.root, `diary: session ${tally.id.slice(0, 12)} ${label}`);
    }
    onWarn(message) {
        this.log.warn(message);
    }
    onInfo(message) {
        this.log.info(message);
    }
}
//# sourceMappingURL=core.js.map