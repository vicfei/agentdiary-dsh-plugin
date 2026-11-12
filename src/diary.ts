// Pure diary logic — no DSH imports, unit-testable on any Node.
// The diary contract mirrors the agentdiary spec (brainvault/agentdiary/design/DESIGN.md):
//   sessions/YYYY-MM/YYYY-MM-DD-<node>.md   append-only entries

import { appendFileSync, execFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

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

function dayFile(p: DiaryPaths, d: Date): string {
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const day = d.toISOString().slice(0, 10);
  return join(p.root, "sessions", ym, `${day}-${p.node}.md`);
}

export function renderEntry(node: string, e: DiaryEntry): string {
  const hhmm = e.at.toISOString().slice(11, 16);
  const one = (s: string) => s.replace(/\s+/g, " ").trim();
  const did = e.did.map((l) => `  - ${one(l)}`).join("\n");
  return [
    "",
    `### ${hhmm} | node=${node} | window=dsh | task=${one(e.task)}`,
    `- 做了什么：`,
    did,
    `- 结果：${one(e.result)}`,
    `- 产物：DeepSeek Harness session（详见 harness 会话存储）`,
    "",
  ].join("\n");
}

/** Append one entry to the node's daily file, creating the day header/dir as needed. */
export function appendEntry(p: DiaryPaths, e: DiaryEntry): string {
  const file = dayFile(p, e.at);
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) {
    writeFileSync(file, `# ${e.at.toISOString().slice(0, 10)} · ${p.node}\n`);
  }
  appendFileSync(file, renderEntry(p.node, e));
  return file;
}

function git(root: string, args: string[]): string {
  return spawnSync("git", ["-C", root, ...args], { encoding: "utf8" }).stdout ?? "";
}

/** Commit + push the diary repo. Offline is fine: entries stay local until the next push. */
export function commitDiary(root: string, message: string): boolean {
  git(root, ["add", "-A"]);
  if (!git(root, ["status", "--porcelain"]).trim()) return false;
  git(root, ["-c", "user.name=agentdiary", "-c", "user.email=agentdiary@localhost", "commit", "-q", "-m", message]);
  try {
    git(root, ["pull", "--rebase", "-q"]);
    git(root, ["push", "-q"]);
  } catch {
    /* offline tolerated */
  }
  return true;
}
