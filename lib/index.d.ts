import type { Context } from "@deepseek-ai/cordis";
import { toEntry } from "./entry.js";
export declare const name = "dsh-agentdiary-plugin";
export declare const inject: string[];
export interface Config {
    /** Absolute path to the agentdiary git repository. */
    repo: string;
    /** This machine's short node name in the diary (e.g. "laptop", "singapore"). */
    node: string;
    /** Commit+push after every entry (true) or only on session end (false). */
    commitEveryEntry: boolean;
}
export declare const Config: Config;
export { toEntry };
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=index.d.ts.map