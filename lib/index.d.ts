import type { Context } from "@deepseek-ai/cordis";
import { type DiaryEntry } from "./diary.js";
export declare const name = "dsh-agentdiary-plugin";
export declare const inject: readonly string[];
export interface Config {
    /** Absolute path to the agentdiary git repository. */
    repo: string;
    /** This machine's short node name in the diary. */
    node: string;
    /** Commit+push after every session entry. */
    commitEveryEntry: boolean;
}
export declare const Config: Config;
interface SessionTally {
    id: string;
    startedAt: Date;
    kinds: Map<string, number>;
}
export declare function summarize(t: SessionTally): DiaryEntry;
export declare function apply(ctx: Context, config: Config): void;
export {};
//# sourceMappingURL=index.d.ts.map