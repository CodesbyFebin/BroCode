import { test } from "node:test";
import assert from "node:assert/strict";
import { detectTestCommand, parseRepairJson, runRepairLoop, safeRelPath } from "../src/lib/agent/loop-core";
import { NEMOTRON, ROLE_TIER, costUsd } from "../src/lib/agent/nebius";
import { execInSandbox } from "../src/lib/agent/sandbox.server";
import { tavilySearch, researchContext } from "../src/lib/agent/tavily";
import { DEMO_FILES } from "../src/lib/agent/seed";
import { DEFAULT_SETTINGS, resolveRoute } from "../src/lib/agent/providers";

const demo = () => Object.fromEntries(Object.values(DEMO_FILES).map((f) => [f.path, f.content]));

test("Nemotron tier routing: Ultra reasons, Nano/Super handle fast calls", () => {
  assert.equal(resolveRoute("orchestrator", DEFAULT_SETTINGS).model, NEMOTRON.ultra);
  assert.equal(resolveRoute("implementer", DEFAULT_SETTINGS).model, NEMOTRON.super);
  assert.equal(resolveRoute("reviewer", DEFAULT_SETTINGS).model, NEMOTRON.nano);
  assert.equal(resolveRoute("tester", DEFAULT_SETTINGS).providerId, "nebius");
  assert.equal(ROLE_TIER.planner, "ultra");
});

test("cost is computed from published Token Factory prices", () => {
  const c = costUsd(NEMOTRON.ultra, { prompt_tokens: 1_000_000, completion_tokens: 1_000_000 });
  assert.equal(c, 4);
  assert.equal(costUsd("unknown", { prompt_tokens: 10 }), 0);
});

test("safeRelPath rejects traversal", () => {
  assert.equal(safeRelPath("../etc/passwd"), null);
  assert.equal(safeRelPath("node_modules/x.js"), null);
  assert.equal(safeRelPath("./src/a.js"), "src/a.js");
});

test("parseRepairJson tolerates fences and prose", () => {
  const r = parseRepairJson('Sure:\n```json\n{"note":"fix","files":[{"path":"a.js","content":"x"}]}\n```');
  assert.equal(r.note, "fix");
  assert.equal(r.files.length, 1);
  assert.equal(parseRepairJson("nope").files.length, 0);
});

test("detectTestCommand", () => {
  assert.equal(detectTestCommand(demo()), "npm test --silent");
  assert.equal(detectTestCommand({ "a.txt": "" }), null);
});

test("local sandbox: demo repo fails, repair loop fixes it, evidence recorded", async () => {
  let repairs = 0;
  const out = await runRepairLoop(
    { files: demo(), command: "npm test --silent", maxAttempts: 3 },
    {
      exec: execInSandbox,
      repair: async () => {
        repairs++;
        return {
          note: "collapse separators and trim dashes",
          model: NEMOTRON.ultra,
          costUsd: 0,
          tokens: 0,
          files: [
            {
              path: "src/slug.js",
              content:
                'export function slugify(input) {\n  return String(input).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");\n}\n',
            },
          ],
        };
      },
    },
  );
  assert.equal(out.passed, true);
  assert.equal(repairs, 1);
  assert.deepEqual(out.changed, ["src/slug.js"]);
  assert.deepEqual(
    out.steps.map((s) => s.kind),
    ["run", "repair", "run"],
  );
  const first = out.steps[0];
  assert.ok(first.kind === "run" && first.exitCode !== 0);
});

test("sandbox does not leak server secrets into executed code", async () => {
  process.env.NEBIUS_API_KEY = "secret-should-not-leak";
  const r = await execInSandbox({ "a.sh": "" }, 'echo "[${NEBIUS_API_KEY:-none}]"');
  assert.match(r.stdout, /\[none\]/);
});

test("step cap stops a loop that never passes", async () => {
  const out = await runRepairLoop(
    { files: { "x.js": "" }, command: "false", maxAttempts: 2 },
    {
      exec: async () => ({ exitCode: 1, stdout: "", stderr: "fail", ms: 1, runner: "fake" }),
      repair: async () => ({ note: "", model: "m", costUsd: 0.01, tokens: 5, files: [{ path: "x.js", content: "1" }] }),
    },
  );
  assert.equal(out.passed, false);
  assert.equal(out.steps.filter((s) => s.kind === "run").length, 2);
});

test("tavily client maps results to citations", async () => {
  const fake = (async () =>
    new Response(JSON.stringify({ answer: "A", results: [{ title: "Docs", url: "https://x.dev", content: "c" }] }), {
      status: 200,
    })) as unknown as typeof fetch;
  const r = await tavilySearch("q", "k", fake);
  assert.equal(r.citations[0]!.url, "https://x.dev");
  assert.match(researchContext(r), /\[1\] Docs/);
});
