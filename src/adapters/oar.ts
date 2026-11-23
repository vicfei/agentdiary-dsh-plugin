// OAR adapter (v0.3 P1) — Open Agent Runtime (botiverse/oar, ~15 harnesses behind one
// programming interface) feeding the same DiaryCore. Zero-dependency by design: the HOST
// owns the OAR session and hands it in duck-typed; this module never imports @botiverse/oar.
//
// Event mapping, probed against oar docs/spec/record-stream.md (2026-11):
//   facts: `tool_call_started` (payload `.tool`) → tool/call; text-bearing deltas
//   (`text_delta`, payload `.text`) → accumulated and fed as assistant/message so the
//   tail-quote stays the message's own ending. Settlement: `turn_ended` (outcome field
//   best-effort; unknown outcomes warn instead of silently dropping — the Cordis lesson).
//   Lifecycle: `released` / `disposed` / `runtime_exited` → the teardown sweep.
// Everything else counts into the event mix. Payload field names that the spec leaves
// open are read tolerantly (several spellings) and flagged by the core's unknown-reason
// warning when they do not match — a silent mismatch cost a smoke round-trip once.

import { DiaryCore } from "../core.js";

export interface OarEvent {
  seq?: number;
  agentPath?: unknown;
  kind?: string;
  text?: string;
  tool?: string;
  outcome?: string;
  turn?: unknown;
  [key: string]: unknown;
}

export interface OarSessionLike {
  /** session.events(callback) — the record stream (docs/spec/record-stream.md). */
  events(callback: (ev: OarEvent) => void): unknown;
}

export interface AttachOarOptions {
  sessionId?: string;
  log?: { info?: (m: string) => void; warn?: (m: string) => void };
}

const SETTLE_KIND = "turn_ended";
const LIFECYCLE = new Set(["released", "disposed", "runtime_exited"]);
const TEXT_KINDS = new Set(["text_delta", "text", "assistant_text", "message_text"]);

/** Attach an OAR session to a DiaryCore. Returns the unsubscribe handle the host may call. */
export function attachOar(session: OarSessionLike, core: DiaryCore, opts: AttachOarOptions = {}): () => void {
  const sessionId = opts.sessionId ?? "oar-session";
  const log = opts.log ?? {};
  const id = String(sessionId);
  let textBuffer = "";
  let sawTurn = false;

  core.handle({ id, phase: "created" });

  const feed = (ev: OarEvent): void => {
    const kind = String(ev.kind ?? "");
    if (LIFECYCLE.has(kind)) {
      core.handle({ id, phase: "disposed" });
      sawTurn = false;
      return;
    }
    if (kind === SETTLE_KIND) {
      const outcome = String(ev.outcome ?? (ev as { status?: unknown }).status ?? "completed");
      core.handle({ id, phase: "event", type: "turn/end", data: { reason: { kind: outcome }, turn: ev.turn } });
      textBuffer = "";
      sawTurn = true;
      return;
    }
    if (TEXT_KINDS.has(kind) && typeof ev.text === "string") {
      // streaming deltas: accumulate, feed the grown tail so the quote ends where it ends
      textBuffer = `${textBuffer} ${ev.text}`.slice(-400);
      core.handle({
        id, phase: "event", type: "assistant/message",
        data: { message: { content: [{ type: "text", text: textBuffer }] } },
      });
      return;
    }
    if (kind === "tool_call_started" || kind === "tool_call") {
      core.handle({ id, phase: "event", type: "tool/call", data: { name: String(ev.tool ?? "unknown") } });
      return;
    }
    core.handle({ id, phase: "event", type: kind || "unknown", data: ev });
  };

  session.events(feed);
  if (!sawTurn) log.warn?.("oar adapter: attached — waiting for turn_ended records");
  return () => log.info?.("oar adapter: detached (stream subscription is host-owned)");
}
