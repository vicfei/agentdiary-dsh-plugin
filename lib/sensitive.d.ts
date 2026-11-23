export interface SensitivePattern {
    kind: string;
    re: RegExp;
}
export declare const DEFAULT_PATTERNS: readonly SensitivePattern[];
export interface SensitiveHit {
    kind: string;
    /** How many matches — never the content itself. */
    count: number;
}
export declare function scanSensitive(text: string, extra?: readonly SensitivePattern[]): SensitiveHit[];
export declare function formatHits(hits: SensitiveHit[]): string;
//# sourceMappingURL=sensitive.d.ts.map