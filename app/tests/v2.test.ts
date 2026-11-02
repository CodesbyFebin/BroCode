import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { nextRun, parseCron } from "../src/lib/v2/cron";
import { Scheduler, sign, validateAutomation, type Automation } from "../src/lib/v2/automations";
import { orchestrate, parseFiles, type OrchDeps } from "../src/lib/v2/orchestrator";
import { MemoryStore } from "../src/lib/v2/memory";
import { Checkpoints, diffFiles } from "../src/lib/v2/checkpoints";
import { McpStdioClient } from "../src/lib/v2/mcp-client";
import { RepoAgent } from "../src/lib/v2/repo-agent";

const here = dirname(fileURLToPath(import.meta.url));
const tmp = () => mkdtemp(join(tmpdir(), "brocode-"));

test("cron: parse, ranges, steps and next run", () => {
  assert.throws(() => parseCron("* * *"));
  assert.throws(() => parseCron("61 * * * *"));
  assert.equal(nextRun("*/15 * * * *", new Date("2026-01-01T00:07:30Z")).toISOString(), "2026-01-01T00:15:00.000Z");
  assert.equal(nextRun("0 9 * * 1-5", new Date("2026-01-02T10:00:00Z")).toISOString(), "2026-01-05T09:00:00.000Z"); // Fri -> Mon
  assert.equal(nextRun("30 2 1 * *", new Date("2026-01-15T00:00:00Z")).toISOString(), "2026-02-01T02:30:00.000Z");
});

test("automations: cron tick fires only when due and reschedules; failures are recorded", async () => {
  let now = new Date("2026-01-01T00:00:10Z");
  const calls: string[] = [];
  const a: Automation = { id: "nightly", name: "n", enabled: true, trigger: { kind: "cron", cron: "*/5 * * * *" }, workflowId: "wf", input: "go" };
  const off: Automation = { ...a, id: "off", enabled: false };
  const s = new Scheduler([a, off], async (x, input) => { calls.push(`${x.id}:${input}`); if (calls.length === 2) throw new Error("boom"); return { ok: true, summary: "done" }; }, () => now);
  assert.equal(a.nextRun, "2026-01-01T00:05:00.000Z");
  assert.deepEqual(await s.tick(), []);
  now = new Date("2026-01-01T00:05:00Z");
  assert.equal((await s.tick())[0].ok, true);
  assert.equal(a.nextRun, "2026-01-01T00:10:00.000Z");
  now = new Date("2026-01-01T00:10:00Z");
  const r = await s.tick();
  assert.equal(r[0].ok, false); assert.equal(r[0].summary, "boom");
  assert.deepEqual(calls, ["nightly:go", "nightly:go"]);
  assert.ok(validateAutomation({ ...a, trigger: { kind: "cron", cron: "bad" } }).length > 0);
  assert.ok(validateAutomation({ ...a, trigger: { kind: "webhook", secretEnv: "lower" } }).length > 0);
});

test("automations: webhook requires a valid HMAC signature from an env secret", async () => {
  const a: Automation = { id: "on-push", name: "p", enabled: true, trigger: { kind: "webhook", secretEnv: "HOOK_SECRET" }, workflowId: "wf", input: "default" };
  const seen: string[] = [];
  const s = new Scheduler([a], async (_x, input) => { seen.push(input); return { ok: true, summary: "ok" }; });
  const body = JSON.stringify({ input: "from hook" });
  assert.equal((await s.webhook("on-push", body, sign("s3cret", body), {})).status, 503);
  assert.equal((await s.webhook("on-push", body, sign("wrong", body), { HOOK_SECRET: "s3cret" })).status, 401);
  assert.equal((await s.webhook("on-push", body, null, { HOOK_SECRET: "s3cret" })).status, 401);
  assert.equal((await s.webhook("nope", body, null, {})).status, 404);
  const ok = await s.webhook("on-push", body, sign("s3cret", body), { HOOK_SECRET: "s3cret" });
  assert.equal(ok.status, 200); assert.deepEqual(seen, ["from hook"]);
});

test("orchestrator: failing test loops back to coder, then reviewer approves", async () => {
  const log: string[] = [];
  let coderCalls = 0;
  const deps: OrchDeps = {
    llm: async (role, tier, prompt) => {
      log.push(`${role}:${tier}`);
      if (role === "planner") return "1. write add";
      if (role === "coder") { coderCalls++; return coderCalls === 1 ? "```file:add.js\nexport const add=(a,b)=>a-b\n```" : (assert.ok(prompt.includes("Tests failed")), "```file:add.js\nexport const add=(a,b)=>a+b\n```"); }
      return "APPROVE";
    },
    exec: async (files) => ({ exitCode: files["add.js"].includes("a+b") ? 0 : 1, output: "expected 3" }),
  };
  const r = await orchestrate("add numbers", {}, "npm test", deps);
  assert.equal(r.ok, true); assert.equal(r.rounds, 2);
  assert.deepEqual(log, ["planner:ultra", "coder:super", "coder:super", "reviewer:ultra"]);
});

test("orchestrator: reviewer rejection and round limit; unsafe paths rejected", async () => {
  const deps: OrchDeps = { llm: async (role) => role === "coder" ? "```file:a.txt\nx\n```" : role === "reviewer" ? "CHANGES: no tests" : "plan", exec: async () => ({ exitCode: 0, output: "" }) };
  const r = await orchestrate("t", {}, "true", deps, 2);
  assert.equal(r.ok, false); assert.equal(r.reason, "round limit reached");
  assert.throws(() => parseFiles("```file:../etc/passwd\nx\n```"));
  assert.throws(() => parseFiles("```file:/abs\nx\n```"));
});

test("memory: persists per project and recalls by keyword", async () => {
  const dir = await tmp();
  const m = new MemoryStore(dir);
  await m.remember("proj", { kind: "decision", text: "Use PGlite for local database", tags: ["db"] });
  await m.remember("proj", { kind: "preference", text: "Prefer tabs in Makefiles", tags: [] });
  await m.remember("other", { kind: "fact", text: "database is postgres", tags: [] });
  const again = new MemoryStore(dir);
  const r = await again.recall("proj", "which database?");
  assert.equal(r.length, 1); assert.match(r[0].text, /PGlite/);
  assert.match(await again.context("proj", "database"), /\[decision\]/);
  assert.deepEqual(await again.all("missing"), []);
  await assert.rejects(() => m.remember("../x", { kind: "fact", text: "x", tags: [] }));
});

test("checkpoints: save, diff, restore and undo", async () => {
  const c = new Checkpoints(await tmp());
  const a = await c.save("p", "first", { "a.txt": "1" });
  await c.save("p", "second", { "a.txt": "2", "b.txt": "x" });
  assert.deepEqual(diffFiles({ "a.txt": "1", "c": "" }, { "a.txt": "2", "b.txt": "x" }), [{ path: "a.txt", change: "modified" }, { path: "b.txt", change: "added" }, { path: "c", change: "removed" }]);
  assert.deepEqual(await c.restore("p", a.id), { "a.txt": "1" });
  assert.deepEqual(await c.undo("p"), { "a.txt": "1" });
  await assert.rejects(() => c.restore("p", "nope"));
});

test("mcp client: initialize, list and call tools over stdio; allowlist enforced", async () => {
  const c = new McpStdioClient(process.execPath, [join(here, "fixtures/fake-mcp.mjs")]);
  try {
    const init = await c.connect();
    assert.equal(init.serverInfo?.name, "fake");
    assert.deepEqual((await c.listTools()).map((t) => t.name), ["add"]);
    assert.equal((await c.callTool("add", { a: 2, b: 3 })).content[0].text, "5");
    await assert.rejects(() => c.callTool("rm", {}, ["add"]), /allowlist/);
    await assert.rejects(() => c.request("bogus"), /method not found/);
  } finally { c.close(); }
});

test("repo agent: clone, branch, apply, diff, commit; PR is a dry run without GH_TOKEN", async () => {
  const origin = await tmp();
  const g = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: origin });
  g("init", "-q", "-b", "main"); await writeFile(join(origin, "README.md"), "hi\n"); g("add", "."); g("commit", "-qm", "init");
  const dir = join(await tmp(), "clone");
  const r = await RepoAgent.clone(origin, dir, {});
  await r.branch("brocode/feature");
  await r.applyFiles({ "src/new.ts": "export const x = 1;\n" });
  await assert.rejects(() => r.applyFiles({ "../escape": "x" }), /unsafe/);
  await assert.rejects(() => r.applyFiles({ ".git/config": "x" }), /unsafe/);
  const sha = await r.commit("feat: add x");
  assert.match(sha, /^[0-9a-f]{40}$/);
  assert.equal(await r.currentBranch(), "brocode/feature");
  assert.equal(await readFile(join(dir, "src/new.ts"), "utf8"), "export const x = 1;\n");
  const pr = await r.openPr("o/r", "t", "b");
  assert.equal(pr.dryRun, true);
  await assert.rejects(() => RepoAgent.clone("ssh://evil", join(dir, "x")));
  await assert.rejects(() => r.branch("bad..name"));
});
