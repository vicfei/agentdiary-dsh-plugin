export interface DiaryEntry {
    /** Wall-clock time of the entry (the event's own timestamp, not write time). */
    at: Date;
    /** One-line task/event summary. */
    task: string;
    /** 2–6 line process overview. */
    did: string[];
    /** Concrete outcome (numbers/refs), single line. */
    result: string;
}
export interface DiaryPaths {
    /** Absolute path to the agentdiary git repo. */
    root: string;
    /** Node short name, e.g. "singapore" / "laptop". */
    node: string;
}
export declare function renderEntry(node: string, e: DiaryEntry): string;
/** Append one entry to the node's daily file, creating the day header/dir as needed. */
export declare function appendEntry(p: DiaryPaths, e: DiaryEntry): string;
/** Commit + push the diary repo. Offline is fine: entries stay local until the next push. */
export declare function commitDiary(root: string, message: string): boolean;
//# sourceMappingURL=diary.d.ts.map