// Pure diary logic — no DSH imports, unit-testable on any Node.
// The diary contract mirrors the agentdiary spec (brainvault/agentdiary/design/DESIGN.md):
//   sessions/YYYY-MM/YYYY-MM-DD-<node>.md   append-only entries
import { appendFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
function dayFile(p, d) {
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const day = d.toISOString().slice(0, 10);
    return join(p.root, "sessions", ym, `${day}-${p.node}.md`);
}
export function renderEntry(node, e) {
    const hhmm = e.at.toISOString().slice(11, 16);
    const one = (s) => s.replace(/\s+/g, " ").trim();
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
export function appendEntry(p, e) {
    const file = dayFile(p, e.at);
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) {
        writeFileSync(file, `# ${e.at.toISOString().slice(0, 10)} · ${p.node}\n`);
    }
    appendFileSync(file, renderEntry(p.node, e));
    return file;
}
function git(root, args) {
    return spawnSync("git", ["-C", root, ...args], { encoding: "utf8" }).stdout ?? "";
}
/** Commit + push the diary repo. Offline is fine: entries stay local until the next push. */
export function commitDiary(root, message) {
    git(root, ["add", "-A"]);
    if (!git(root, ["status", "--porcelain"]).trim())
        return false;
    git(root, ["-c", "user.name=agentdiary", "-c", "user.email=agentdiary@localhost", "commit", "-q", "-m", message]);
    try {
        git(root, ["pull", "--rebase", "-q"]);
        git(root, ["push", "-q"]);
    }
    catch {
        /* offline tolerated */
    }
    return true;
}
//# sourceMappingURL=diary.js.map