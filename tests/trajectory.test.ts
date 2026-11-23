// TrajectorySink + sensitive scan (v0.4 P2): one JSONL line per settled turn, greppable,
// sensitive-scan warns without echoing content, tokens ride when the host reports them.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiaryCore } from "../src/core.js";
import { MarkdownSink } from "../src/core.js";
import { TrajectorySink } from "../src/trajectory.js";
import { scanSensitive } from "../src/sensitive.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dsh-traj-"));
  execSync("git init -q .", { cwd: dir });
  execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -m init -q', { cwd: dir });
});

describe("scanSensitive", () => {
  it("catches the built-in families and reports kinds only, never content", () => {
    const hits = scanSensitive('my key is ghp_ABCDEFGHIJKLMNOPQR and see corp.corporate.net for https://intra.paic.com/x; jwt eyJhbGciOi.eyJzdWIiOiJ1.cCJ9abcde');
    const kinds = hits.map((h) => h.kind);
    expect(kinds).toContain("github-pat");
    expect(kinds).toContain("jwt");
    expect(kinds).toContain("corporate-domain");
    expect(JSON.stringify(hits)).not.toContain("ghp_ABCDEFGHIJKLMNOPQR");
  });
  it("clean text → no hits; owner patterns extend the set", () => {
    expect(scanSensitive("just prose, nothing to see")).toEqual([]);
    const hits = scanSensitive("internal codename: project-bluefin", [{ kind: "owner-1", re: /bluefin/g }]);
    expect(hits).toEqual([{ kind: "owner-1", count: 1 }]);
  });
});

describe("TrajectorySink", () => {
  function make() {
    const log = { info: vi.fn(), warn: vi.fn() };
    const day = new Date().toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const file = join(dir, "trajectories", month, `${day}-test-node.jsonl`);
    const traj = new TrajectorySink({ root: dir, node: "test-node", log });
    const core = new DiaryCore({ node: "test-node" }, [new MarkdownSink(dir, "test-node", false, log), traj]);
    return { log, file, core };
  }
  it("one JSONL line per settled turn with the full structured record", () => {
    const { file, core } = make();
    core.handle({ id: "s1", phase: "created" });
    core.handle({ id: "s1", phase: "event", type: "tool/call", data: { name: "bash" } });
    core.handle({ id: "s1", phase: "event", type: "tool/call", data: { name: "bash" } });
    core.handle({ id: "s1", phase: "event", type: "turn/end", data: { reason: { kind: "completed" }, turn: 1, usage: { prompt_tokens: 640, completion_tokens: 120 } } });
    const rec = JSON.parse(readFileSync(file, "utf8").trim().split("\n")[0]) as Record<string, unknown>;
    expect(rec).toMatchObject({ node: "test-node", label: "turn 1 completed", outcome: "completed", tokens: { input: 640, output: 120 } });
    expect(rec.tools).toEqual([{ name: "bash", count: 2 }]);
  });
  it("sensitive content warns (and still writes) — kind list only, no content echo", () => {
    const { log, file, core } = make();
    core.handle({ id: "s", phase: "created" });
    core.handle({ id: "s", phase: "event", type: "assistant/message", data: { message: { content: [{ type: "text", text: "deployed with token ghp_ABCDEFGHIJKLMNOPQR" }] } } });
    core.handle({ id: "s", phase: "event", type: "turn/end", data: { reason: { kind: "completed" }, turn: 1 } });
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("github-pat"));
    expect(log.warn).toHaveBeenCalledWith(expect.not.stringContaining("ghp_ABCDEFGHIJKLMNOPQR"));
    expect(readFileSync(file, "utf8")).toContain("turn 1 completed"); // warn, not block
  });
  it("no usage reported → no tokens field", () => {
    const { file, core } = make();
    core.handle({ id: "s", phase: "created" });
    core.handle({ id: "s", phase: "event", type: "turn/end", data: { reason: { kind: "error" }, turn: 1 } });
    const rec = JSON.parse(readFileSync(file, "utf8").trim());
    expect("tokens" in rec).toBe(false);
    expect(rec.outcome).toBe("error");
  });
});
