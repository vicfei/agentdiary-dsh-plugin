import type { DiarySink } from "./core.js";
import type { DiaryEntry } from "./diary.js";
import type { TurnTally } from "./core.js";
export interface TrajectoryRecord {
    at: string;
    node: string;
    session: string;
    label: string;
    outcome: string;
    durationActiveMs: number;
    tools: {
        name: string;
        count: number;
    }[];
    events: Record<string, number>;
    lastText: string;
    tokens?: {
        input: number;
        output: number;
    };
}
export interface TrajectoryOptions {
    root: string;
    node: string;
    /** Extra owner patterns (regex strings) beyond the built-ins. */
    extraSensitivePatterns?: string[];
    log?: {
        info?: (m: string) => void;
        warn?: (m: string) => void;
    };
}
export declare class TrajectorySink implements DiarySink {
    private readonly opts;
    private readonly extra;
    constructor(opts: TrajectoryOptions);
    onEntry(entry: DiaryEntry, label: string, tally: TurnTally): void;
    onWarn(message: string): void;
    onInfo(message: string): void;
}
//# sourceMappingURL=trajectory.d.ts.map