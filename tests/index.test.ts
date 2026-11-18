// v0.1.1 contract tests — the diary keys on turn settlement, not session disposal.
// Drives apply() through a fake Cordis ctx: captured handlers + synthetic events,
// exactly the stream the win11 smoke showed the harness emitting.
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  logger: { info: () => {}, warn: () => {} },
} as never;

const start = (): void => {
  apply(ctx, { repo: dir, node: "laptop", commitEveryEntry: false });
};
const emit = (type: string, extra: Record<string, unknown> = {}): void =>
  handlers.get("session/event")!({ id: "s1" }, { type, ...extra });
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
