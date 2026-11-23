// DiaryCore + adapters (v0.3 P1): the harness-agnostic seam — Cordis and OAR feed the
// same engine; the markdown sink behavior is byte-compatible with the 0.2.x adapter.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiaryCore, MarkdownSink, type RawSessionEvent, type TurnTally } from "../src/core.js";
import { attachOar, type OarEvent } from "../src/adapters/oar.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dsh-core-"));
  execSync("git init -q .", { cwd: dir });
  execSync('git -c user.email=t@t -c user.name=t commit --allow-empty -m init -q', { cwd: dir });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeCore() {
  const log = { info: vi.fn(), warn: vi.fn() };
  const sink = new MarkdownSink(dir, "test-node", true, log);
  const core = new DiaryCore({ node: "test-node" }, [sink]);
  return { core, log };
}

describe("DiaryCore (direct feed)", () => {
  it("a settled turn writes the same rich entry shape the Cordis adapter produced in 0.2.x", () => {
    const { core } = makeCore();
    core.handle({ id: "s1", phase: "created" });
    core.handle({ id: "s1", phase: "event", type: "tool/call", data: { name: "bash" } });
    core.handle({ id: "s1", phase: "event", type: "assistant/message", data: { message: { content: [{ type: "text", text: "all 12 tests pass now." }] } } });
    core.handle({ id: "s1", phase: "event", type: "turn/end", data: { reason: { kind: "completed" }, turn: 3 } });
    const day = readFileSync(join(dir, "sessions", new Date().toISOString().slice(0, 7), `${new Date().toISOString().slice(0, 10)}-test-node.md`), "utf8");
    expect(day).toContain("turn 3 completed");
    expect(day).toContain("tools: bash×1");
    expect(day).toContain("said: “all 12 tests pass now.”");
  });
  it("unknown turn outcomes warn instead of dropping silently; quiet reasons stay quiet", () => {
    const { core, log } = makeCore();
    core.handle({ id: "s", phase: "created" });
    core.handle({ id: "s", phase: "event", type: "turn/end", data: { reason: { kind: "blocked" } } });
    core.handle({ id: "s", phase: "event", type: "turn/end", data: { reason: { kind: "weird-thing" } } });
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining("weird-thing"));
  });
  it("a session torn down mid-turn gets a clearly labeled sweep line", () => {
    const { core } = makeCore();
    core.handle({ id: "s", phase: "created" });
    core.handle({ id: "s", phase: "event", type: "tool/call", data: { name: "edit" } });
    core.handle({ id: "s", phase: "disposed" });
    const day = readFileSync(join(dir, "sessions", new Date().toISOString().slice(0, 7), `${new Date().toISOString().slice(0, 10)}-test-node.md`), "utf8");
    expect(day).toContain("session torn down mid-turn");
  });
  it("multiple sinks all receive the entry", () => {
    const a = { onEntry: vi.fn(), onWarn: vi.fn(), onInfo: vi.fn() };
    const b = { onEntry: vi.fn(), onWarn: vi.fn(), onInfo: vi.fn() };
    const core = new DiaryCore({ node: "n" }, [a, b]);
    core.handle({ id: "s", phase: "created" });
    core.handle({ id: "s", phase: "event", type: "turn/end", data: { reason: { kind: "completed" }, turn: 1 } });
    expect(a.onEntry).toHaveBeenCalledTimes(1);
    expect(b.onEntry).toHaveBeenCalledTimes(1);
  });
});

describe("attachOar (the EventSource seam, probed against record-stream.md)", () => {
  const feed = (evs: OarEvent[], events = vi.fn()) => {
    const events_ = events as unknown as OarSessionish;
    const { core, log } = makeCore();
    attachOar({ events: (cb) => { events_._cb = cb; } } as never, core, { sessionId: "oar-1", log });
    for (const e of evs) (events_._cb as (e: OarEvent) => void)(e);
    return { log };
  };
  type OarSessionish = { _cb: (e: OarEvent) => void };

  function makeCore(): { core: DiaryCore; log: { info: any; warn: any } } {
    const log = { info: vi.fn(), warn: vi.fn() };
    const sink = new MarkdownSink(dir, "test-node", true, log);
    const core = new DiaryCore({ node: "test-node" }, [sink]);
    return { core, log };
  }
  void (0 as unknown as RawSessionEvent);
  void (0 as unknown as TurnTally);

  it("text deltas accumulate into the tail quote; tool_call_started maps to tool/call", () => {
    feed([
      { kind: "text_delta", text: "refactored the parser," },
      { kind: "text_delta", text: " all 9 tests green." },
      { kind: "tool_call_started", tool: "read_file" },
      { kind: "turn_ended", outcome: "completed", turn: 2 },
    ]);
    const day = readFileSync(join(dir, "sessions", new Date().toISOString().slice(0, 7), `${new Date().toISOString().slice(0, 10)}-test-node.md`), "utf8");
    expect(day).toContain("said: “refactored the parser, all 9 tests green.”");
    expect(day).toContain("tools: read_file×1");
    expect(day).toContain("turn 2 completed");
  });

  it("lifecycle records sweep an unfinished turn; unknown settle outcomes warn, not drop", () => {
    const { log } = feed([
      { kind: "tool_call_started", tool: "bash" },
      { kind: "released" },
    ]);
    const day = readFileSync(join(dir, "sessions", new Date().toISOString().slice(0, 7), `${new Date().toISOString().slice(0, 10)}-test-node.md`), "utf8");
    expect(day).toContain("session torn down mid-turn");
    const { log: log2 } = (function () {
      const { core, log } = makeCore();
      const cb = vi.fn();
      attachOar({ events: (f) => { (cb as unknown as { _cb?: unknown }).x = 0; (f as unknown as (e: OarEvent) => void)({ kind: "turn_ended", outcome: "mystery" }); } } as never, core, { sessionId: "s" });
      return { log };
    })();
    expect(log2.warn).toHaveBeenCalledWith(expect.stringContaining("mystery"));
    void log;
  });
});
