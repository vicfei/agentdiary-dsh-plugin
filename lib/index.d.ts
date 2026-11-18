import type { Context } from "@deepseek-ai/cordis";
import Schema from "@deepseek-ai/schemastery";
import { type DiaryEntry } from "./diary.js";
export declare const name = "dsh-agentdiary-plugin";
export declare const inject: readonly string[];
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
    repo: Schema<string, string, "defined">;
    node: Schema<string, string, "defined">;
    commitEveryEntry: Schema<boolean, boolean, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    repo: Schema<string, string, "defined">;
    node: Schema<string, string, "defined">;
    commitEveryEntry: Schema<boolean, boolean, "defined">;
}>>, "plain">;
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
export { toEntry } from "./entry.js";
export declare function summarize(t: TurnTally, label: string): DiaryEntry;
/** Pull the plain text out of an assistant message's content blocks
 *  (ContentBlock union: text blocks are { type: 'text', text }). */
export declare function assistantText(data: unknown): string;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map