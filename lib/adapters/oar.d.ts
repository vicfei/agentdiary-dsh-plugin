import { DiaryCore } from "../core.js";
export interface OarEvent {
    seq?: number;
    agentPath?: unknown;
    kind?: string;
    text?: string;
    tool?: string;
    outcome?: string;
    turn?: unknown;
    [key: string]: unknown;
}
export interface OarSessionLike {
    /** session.events(callback) — the record stream (docs/spec/record-stream.md). */
    events(callback: (ev: OarEvent) => void): unknown;
}
export interface AttachOarOptions {
    sessionId?: string;
    log?: {
        info?: (m: string) => void;
        warn?: (m: string) => void;
    };
}
/** Attach an OAR session to a DiaryCore. Returns the unsubscribe handle the host may call. */
export declare function attachOar(session: OarSessionLike, core: DiaryCore, opts?: AttachOarOptions): () => void;
//# sourceMappingURL=oar.d.ts.map