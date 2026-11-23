// TrajectorySink (v0.4 P2) — the machine-readable sibling of the markdown diary:
// one JSONL line per settled turn at trajectories/YYYY-MM/DD-node.jsonl. This is the
// capture layer the thin-agent distillation plan named ("audit.jsonl ≈ 90% of a
// trajectory recorder"): structured, greppable, owned by the same append-only git
// repo as the diary. Every line passes the sensitive-scan first — warn, never block.

import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { scanSensitive, formatHits, type SensitivePattern } from "./sensitive.js";
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
  tools: { name: string; count: number }[];
  events: Record<string, number>;
  lastText: string;
  tokens?: { input: number; output: number };
}

export interface TrajectoryOptions {
  root: string;
  node: string;
  /** Extra owner patterns (regex strings) beyond the built-ins. */
  extraSensitivePatterns?: string[];
  log?: { info?: (m: string) => void; warn?: (m: string) => void };
}

export class TrajectorySink implements DiarySink {
  private readonly extra: SensitivePattern[];
  constructor(private readonly opts: TrajectoryOptions) {
    this.extra = (opts.extraSensitivePatterns ?? []).map((pattern, i) => ({ kind: `owner-${i + 1}`, re: new RegExp(pattern, "g") }));
  }
  onEntry(entry: DiaryEntry, label: string, tally: TurnTally): void {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const day = now.toISOString().slice(0, 10);
    const file = join(this.opts.root, "trajectories", month, `${day}-${this.opts.node}.jsonl`);
    const text = JSON.stringify(recordOf(this.opts.node, entry, label, tally));
    const hits = scanSensitive(text, this.extra);
    if (hits.length > 0) {
      this.opts.log?.warn?.(`trajectory: sensitive content detected (${formatHits(hits)}) — line written, review before exporting`);
    }
    mkdirSync(join(this.opts.root, "trajectories", month), { recursive: true });
    appendFileSync(file, `${text}\n`, "utf8");
    this.opts.log?.info?.(`trajectory -> ${file}`);
  }
  onWarn(message: string): void {
    this.opts.log?.warn?.(message);
  }
  onInfo(message: string): void {
    this.opts.log?.info?.(message);
  }
}

function recordOf(node: string, entry: DiaryEntry, label: string, tally: TurnTally): TrajectoryRecord {
  const outcome = label.split(" ").slice(-1)[0] ?? "";
  return {
    at: entry.at.toISOString(),
    node,
    session: tally.id,
    label,
    outcome,
    durationActiveMs: Math.round(tally.activeMs),
    tools: [...tally.tools.entries()].map(([name, count]) => ({ name, count })),
    events: Object.fromEntries(tally.kinds.entries()),
    lastText: tally.lastText,
    ...(tally.usage ? { tokens: tally.usage } : {}),
  };
}
