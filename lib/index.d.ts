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
interface SessionTally {
    id: string;
    startedAt: Date;
    kinds: Map<string, number>;
}
export { toEntry } from "./entry.js";
export declare function summarize(t: SessionTally): DiaryEntry;
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map