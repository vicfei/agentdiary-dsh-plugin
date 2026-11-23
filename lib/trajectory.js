// TrajectorySink (v0.4 P2) — the machine-readable sibling of the markdown diary:
// one JSONL line per settled turn at trajectories/YYYY-MM/DD-node.jsonl. This is the
// capture layer the thin-agent distillation plan named ("audit.jsonl ≈ 90% of a
// trajectory recorder"): structured, greppable, owned by the same append-only git
// repo as the diary. Every line passes the sensitive-scan first — warn, never block.
import { mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { scanSensitive, formatHits } from "./sensitive.js";
export class TrajectorySink {
    opts;
    extra;
    constructor(opts) {
        this.opts = opts;
        this.extra = (opts.extraSensitivePatterns ?? []).map((pattern, i) => ({ kind: `owner-${i + 1}`, re: new RegExp(pattern, "g") }));
    }
    onEntry(entry, label, tally) {
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
    onWarn(message) {
        this.opts.log?.warn?.(message);
    }
    onInfo(message) {
        this.opts.log?.info?.(message);
    }
}
function recordOf(node, entry, label, tally) {
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
//# sourceMappingURL=trajectory.js.map