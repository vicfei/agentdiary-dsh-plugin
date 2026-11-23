import { type DiaryEntry } from "./diary.js";
export interface RawSessionEvent {
    /** The session this event belongs to (host-scoped id). */
    id: string;
    /** Lifecycle phase: a session was created, an event fired inside it, or it went away. */
    phase: "created" | "event" | "disposed";
    /** Event type in the harness vocabulary (e.g. "tool/call", "assistant/message", "turn/end"). */
    type?: string;
    /** The typed payload; the harness's `.data` wrapper is already unwrapped by the adapter. */
    data?: unknown;
}
/** One open tally per session — counts events since the last settled turn. */
export interface TurnTally {
    id: string;
    startedAt: Date;
    kinds: Map<string, number>;
    tools: Map<string, number>;
    lastText: string;
    /** Active-duration accounting: wall-clock between events, each gap capped — a turn that
     *  sat 160 min waiting on a human approval reads ~15 min, not ~164 (win11 smoke). */
    activeMs: number;
    lastEventAt: number;
    /** Token usage when the host reports it (turn/end payload `.usage`, or any event
     *  carrying one — OpenAI or plain spellings). Forward-compatible: absent = unknown. */
    usage?: {
        input: number;
        output: number;
    };
}
/** turn/end reasons that mean "this task attempt settled" — the rest are
 *  bookkeeping closers (interrupted/forked) or may be retried (blocked). */
export declare const SETTLED: Set<string>;
/** turn/end reasons we deliberately do not diary, without warning. */
export declare const QUIET: Set<string>;
/** How much of the assistant's closing text the diary quotes (pure extraction,
 *  no model calls — the quote is what the agent SAID, verbatim, tail-kept). */
export declare const QUOTE_MAX = 160;
/** Any silent gap longer than this counts as waiting (approval, human, lunch), not work. */
export declare const IDLE_GAP_CAP_MS: number;
export interface DiarySink {
    /** A settled turn (or a teardown sweep) — the sink owns its own persistence. */
    onEntry(entry: DiaryEntry, label: string, tally: TurnTally): void;
    onWarn(message: string): void;
    onInfo(message: string): void;
}
export interface CoreOptions {
    node: string;
}
export declare function summarize(t: TurnTally, label: string): DiaryEntry;
/** Pull the plain text out of an assistant message's content blocks
 *  (ContentBlock union: text blocks are { type: 'text', text }). */
export declare function assistantText(data: unknown): string;
export declare class DiaryCore {
    private readonly opts;
    private readonly sinks;
    private readonly open;
    constructor(opts: CoreOptions, sinks: DiarySink[]);
    private fresh;
    private write;
    /** The one entry point adapters feed. */
    handle(e: RawSessionEvent): void;
}
/** The markdown-diary sink: append + commit, the plugin's original behavior. */
export declare class MarkdownSink implements DiarySink {
    private readonly root;
    private readonly node;
    private readonly commitEveryEntry;
    private readonly log;
    constructor(root: string, node: string, commitEveryEntry: boolean, log: {
        info: (m: string) => void;
        warn: (m: string) => void;
    });
    onEntry(entry: DiaryEntry, label: string, tally: TurnTally): void;
    onWarn(message: string): void;
    onInfo(message: string): void;
}
//# sourceMappingURL=core.d.ts.map