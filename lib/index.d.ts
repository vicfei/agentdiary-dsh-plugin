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
}
export { toEntry } from "./entry.js";
export declare function summarize(t: TurnTally, label: string): DiaryEntry;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map