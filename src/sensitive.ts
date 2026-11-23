// Sensitive-content scan (v0.4 P2) — the JSONL trajectory export is machine-readable and
// therefore far more greppable than prose. Two live lessons shaped this: GitHub Push
// Protection blocked a real token in a diary commit (11-16), and a corporate domain rode
// into an exported handbook via annotations (11-18, force-push recovery). The scan WARNS
// — it never blocks (the owner's zero-redaction ruling stands for private repos) — and it
// reports kinds only, never echoing the matched content.

export interface SensitivePattern {
  kind: string;
  re: RegExp;
}

export const DEFAULT_PATTERNS: readonly SensitivePattern[] = [
  { kind: "github-pat", re: /gh[pousr]_[A-Za-z0-9]{16,}/g },
  { kind: "openai-style-key", re: /sk-[A-Za-z0-9_-]{16,}/g },
  { kind: "npm-token", re: /npm_[A-Za-z0-9]{20,}/g },
  { kind: "aws-access-key", re: /AKIA[0-9A-Z]{16}/g },
  { kind: "private-key-block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: "jwt", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g },
  { kind: "corporate-domain", re: /\b[\w.-]+\.(pingan|paic)\.com\b/gi },
];

export interface SensitiveHit {
  kind: string;
  /** How many matches — never the content itself. */
  count: number;
}

export function scanSensitive(text: string, extra: readonly SensitivePattern[] = []): SensitiveHit[] {
  const hits: SensitiveHit[] = [];
  for (const { kind, re } of [...DEFAULT_PATTERNS, ...extra]) {
    const m = text.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`));
    if (m && m.length > 0) hits.push({ kind, count: m.length });
  }
  return hits;
}

export function formatHits(hits: SensitiveHit[]): string {
  return hits.map((h) => `${h.kind}×${h.count}`).join(", ");
}
