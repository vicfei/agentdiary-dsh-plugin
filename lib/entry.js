// Event → diary entry mapping. This is the ONE seam to verify against the generated
// Cordis catalog of @deepseek-ai/dsh (exact `session/event` signature).
export function toEntry(node, ev) {
    const type = String(ev.type ?? ev.event ?? "");
    const at = new Date(String(ev.time ?? ev.timestamp ?? Date.now()));
    const summary = String(ev.summary ?? ev.content ?? type);
    if (!type)
        return null;
    return { at, task: `dsh ${type}`, did: [summary.slice(0, 400)], result: type };
}
//# sourceMappingURL=entry.js.map