// v0.1.1 contract tests — the diary keys on turn settlement, not session disposal.
// Drives apply() through a fake Cordis ctx: captured handlers + synthetic events,
// exactly the stream the win11 smoke showed the harness emitting.
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apply } from "../src/index.ts";

let dir: string;
const handlers = new Map<string, (session: unknown, event?: unknown) => void>();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agentdiary-ix-"));
  execSync("git init -q -b main .", { cwd: dir });
  handlers.clear();
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const ctx = {
  on: (name: string, fn: (session: unknown, event?: unknown) => void) => handlers.set(name, fn),
  logger: { info: () => {}, warn: (m: string) => warns.push(String(m)) },
} as never;
const warns: string[] = [];

const start = (): void => {
  warns.length = 0;
  apply(ctx, { repo: dir, node: "laptop", commitEveryEntry: false });
};
// the harness's real dispatch shape: { type, seq, time, data: { turn, reason } }
const emit = (type: string, data: Record<string, unknown> = {}): void =>
  handlers.get("session/event")!({ id: "s1" }, { type, seq: 1, time: 0, data });
const dayFile = (): string => {
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  return join(dir, "sessions", ym, `${today}-laptop.md`);
};

describe("agentdiary trigger contract (v0.1.1)", () => {
  it("writes one entry per settled turn/end, labeled with turn and reason", () => {
    start();
    handlers.get("session/created")!({ id: "s1" });
    emit("turn/start", { turn: 1 });
    emit("user/message", {});
    emit("assistant/message", {});
    emit("turn/end", { turn: 1, reason: { kind: "completed" } });
    const body = readFileSync(dayFile(), "utf8");
    expect(body).toContain("turn 1 completed");
    expect(body).toContain("assistant/message×1");

    // second settled turn → its own entry, tally reset in between
    emit("turn/start", { turn: 2 });
    emit("tool/call", { name: "bash" });
    emit("turn/end", { turn: 2, reason: { kind: "error", error: { message: "x" } } });
    const body2 = readFileSync(dayFile(), "utf8");
    expect(body2).toContain("turn 2 error");
    expect(body2.indexOf("turn 1 completed")).toBeLessThan(body2.indexOf("turn 2 error"));
    expect(body2.match(/tool\/call×1/g)).toHaveLength(1);
  });

  it("also accepts the flat dispatch shape (no .data wrapper) — either way the turn lands", () => {
    start();
    handlers.get("session/event")!({ id: "s1" }, { type: "turn/end", turn: 7, reason: { kind: "completed" } });
    expect(readFileSync(dayFile(), "utf8")).toContain("turn 7 completed");
  });

  it("warns on a turn/end whose reason.kind is neither settled nor known-quiet", () => {
    start();
    emit("turn/end", { turn: 1, reason: { kind: "wat" } });
    expect(warns.some(w => w.includes("wat"))).toBe(true);
    expect(existsSync(dayFile())).toBe(false);
    emit("turn/end", { turn: 2, reason: { kind: "blocked" } }); // known-quiet: no warn
    expect(warns.length).toBe(1);
  });

  it("does NOT write for blocked/interrupted/forked closers, but rolls the tally over", () => {
    start();
    emit("user/message", {});
    emit("turn/end", { turn: 1, reason: { kind: "blocked" } });
    expect(existsSync(dayFile())).toBe(false);
    emit("assistant/message", {});
    emit("turn/end", { turn: 2, reason: { kind: "interrupted" } });
    expect(existsSync(dayFile())).toBe(false);
    // the rolled-over events surface in the next settled entry
    emit("turn/end", { turn: 3, reason: { kind: "completed" } });
    const body = readFileSync(dayFile(), "utf8");
    expect(body.match(/### /g)).toHaveLength(1);
    expect(body).toContain("user/message×1");
    expect(body).toContain("assistant/message×1");
  });

  it("disposal alone writes nothing; disposal mid-flight writes a teardown line", () => {
    start();
    emit("turn/end", { turn: 1, reason: { kind: "completed" } });
    handlers.get("session/disposed")!({ id: "s1" }); // nothing pending → no teardown entry
    expect(readFileSync(dayFile(), "utf8").match(/### /g)).toHaveLength(1);

    emit("user/message", {});
    handlers.get("session/disposed")!({ id: "s1" }); // events without a turn/end → swept
    expect(readFileSync(dayFile(), "utf8")).toContain("session torn down mid-turn");
  });
});

describe("P1 rich entries (0.2.0)", () => {
  it("tools and the assistant's closing words land in the entry body", () => {
    start();
    emit("turn/start", { turn: 1 });
    emit("tool/call", { turn: 1, step: 1, callId: "c1", name: "bash", arguments: "{}" });
    emit("tool/call", { turn: 1, step: 2, callId: "c2", name: "bash", arguments: "{}" });
    emit("tool/call", { turn: 1, step: 3, callId: "c3", name: "edit", arguments: "{}" });
    emit("assistant/message", { turn: 1, step: 4, message: { id: "m1", role: "assistant", content: [
      { type: "tool_use", name: "bash" },
      { type: "text", text: "Fixed the parser.\nAll 12 tests pass now." },
    ], source: { kind: "model" } } });
    emit("turn/end", { turn: 1, reason: { kind: "completed" } });
    const body = readFileSync(dayFile(), "utf8");
    expect(body).toContain("tools: bash×2 · edit×1");
    expect(body).toContain("said: “Fixed the parser. All 12 tests pass now.”");
    expect(body).toContain("turn 1 completed");
  });

  it("long closing text is tail-quoted with an ellipsis; non-text blocks ignored", () => {
    start();
    emit("assistant/message", { turn: 1, step: 1, message: { content: [
      { type: "text", text: "A".repeat(400) + " THE-END" },
    ] } });
    emit("turn/end", { turn: 1, reason: { kind: "completed" } });
    const body = readFileSync(dayFile(), "utf8");
    expect(body).toContain("…");
    expect(body).toContain("THE-END”");
    expect(body).toContain("A".repeat(100)); // tail-kept, head truncated
  });
});

describe("active duration (0.2.1)", () => {
  it("a long idle gap waiting on a human counts at most the cap, not wall-clock", async () => {
    vi.useFakeTimers();
    try {
      start();
      emit("turn/start", { turn: 1 });                       // t0
      vi.advanceTimersByTime(60_000);
      emit("user/message", {});                               // +1 min active
      vi.advanceTimersByTime(164 * 60_000);                   // the approval wait — dead time
      vi.setSystemTime(Date.now() + 30_000);
      emit("turn/end", { turn: 1, reason: { kind: "completed" } }); // +cap only
      const body = readFileSync(dayFile(), "utf8");
      expect(body).toMatch(/over ~16 min/); // 1 + 15(cap) + 0.5 ≈ 16 — NOT ~165
    } finally {
      vi.useRealTimers();
    }
  });
});
