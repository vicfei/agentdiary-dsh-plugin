import { mkdtempSync, rmSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendEntry, renderEntry, type DiaryEntry } from "../src/diary.ts";
import { toEntry } from "../src/entry.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agentdiary-"));
  execSync("git init -q -b main .", { cwd: dir });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const entry: DiaryEntry = {
  at: new Date("2026-11-12T10:30:00Z"),
  task: "session settled: refactor parser",
  did: ["read 3 files", "proposed patch", "tests green"],
  result: "session/event recorded",
};

describe("diary", () => {
  it("creates the day file with header, then appends in order", () => {
    const f = appendEntry({ root: dir, node: "laptop" }, entry);
    expect(f).toBe(join(dir, "sessions/2026-11/2026-11-12-laptop.md"));
    let body = readFileSync(f, "utf8");
    expect(body).toContain("# 2026-11-12 · laptop");
    expect(body).toContain("### 10:30 | node=laptop | window=dsh");
    appendEntry({ root: dir, node: "laptop" }, { ...entry, at: new Date("2026-11-12T11:00:00Z") });
    body = readFileSync(f, "utf8");
    expect(body.indexOf("10:30")).toBeLessThan(body.indexOf("11:00"));
  });

  it("renders single-line fields even for multiline input", () => {
    const r = renderEntry("laptop", { ...entry, task: "a\nb  c" });
    expect(r).toContain("task=a b c");
    expect(r.match(/\n- 做了什么：\n/g)).toHaveLength(1);
  });

  it("toEntry maps an event and rejects empty ones", () => {
    const e = toEntry("laptop", { type: "assistant/message", time: "2026-11-12T09:00:00Z", summary: "hello" });
    expect(e?.task).toBe("dsh assistant/message");
    expect(toEntry("laptop", {})).toBeNull();
  });
});
