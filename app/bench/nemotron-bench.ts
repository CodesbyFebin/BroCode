/**
 * Nemotron tier benchmark on Nebius Token Factory.
 * For each task x tier (Nano / Super / Ultra): ask the model to implement a
 * function, run the hidden tests in the sandbox, optionally repair once, and
 * record pass@1, pass-after-repair, latency and USD cost (from public prices).
 *
 *   NEBIUS_API_KEY=... npm run bench            # local
 *   docker build -f bench/Dockerfile -t codingagent-bench . # Nebius Serverless Job image
 *
 * Writes bench/results.json and bench/results.md. Never edit numbers by hand.
 */
import { writeFile } from "node:fs/promises";
import { NEMOTRON, type NemotronTier } from "../src/lib/agent/nebius";
import { nebiusChat } from "../src/lib/agent/llm.server";
import { parseRepairJson, runRepairLoop } from "../src/lib/agent/loop-core";
import { execInSandbox } from "../src/lib/agent/sandbox.server";
import { TASKS } from "./tasks";

const tiers = (process.env.BENCH_TIERS || "nano,super,ultra").split(",") as NemotronTier[];
const SYSTEM =
  'You are a coding agent. Reply ONLY with JSON {"note":"...","files":[{"path":"src/solution.js","content":"FULL file"}]}. Use ESM (export function ...). No tests.';

type Row = { task: string; tier: NemotronTier; model: string; pass1: boolean; passRepair: boolean; ms: number; costUsd: number; error?: string };

async function one(task: (typeof TASKS)[number], tier: NemotronTier): Promise<Row> {
  const model = NEMOTRON[tier];
  const started = Date.now();
  let cost = 0;
  try {
    const first = await nebiusChat({ model, maxTokens: 3000, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: task.prompt }] });
    cost += first.costUsd;
    const src = parseRepairJson(first.text).files.find((f) => f.path.endsWith("solution.js"))?.content ?? "";
    const files = { "package.json": '{"type":"module","scripts":{"test":"node --test tests/"}}', "src/solution.js": src, "tests/hidden.test.js": task.test };
    const out = await runRepairLoop(
      { files, command: "npm test --silent", maxAttempts: 2 },
      {
        exec: execInSandbox,
        repair: async ({ files: cur, output }) => {
          const r = await nebiusChat({
            model,
            maxTokens: 3000,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: `${task.prompt}\n\nYour code:\n${cur["src/solution.js"]}\n\nTest failure:\n${output}` },
            ],
          });
          const p = parseRepairJson(r.text);
          return { files: p.files.filter((f) => f.path.endsWith("solution.js")).map((f) => ({ path: "src/solution.js", content: f.content })), note: p.note, model, costUsd: r.costUsd, tokens: 0 };
        },
      },
    );
    cost += out.costUsd;
    const firstRun = out.steps.find((s) => s.kind === "run");
    return { task: task.id, tier, model, pass1: !!firstRun && firstRun.kind === "run" && firstRun.exitCode === 0, passRepair: out.passed, ms: Date.now() - started, costUsd: cost };
  } catch (err) {
    return { task: task.id, tier, model, pass1: false, passRepair: false, ms: Date.now() - started, costUsd: cost, error: String(err).slice(0, 200) };
  }
}

async function main() {
  if (!process.env.NEBIUS_API_KEY) {
    console.error("NEBIUS_API_KEY is required");
    process.exit(2);
  }
  const rows: Row[] = [];
  for (const tier of tiers) for (const task of TASKS) {
    const r = await one(task, tier);
    rows.push(r);
    console.log(JSON.stringify(r));
  }
  const md = ["| Tier | Model | pass@1 | pass after 1 repair | avg latency (s) | total cost (USD) |", "|---|---|---|---|---|---|"];
  for (const tier of tiers) {
    const rs = rows.filter((r) => r.tier === tier);
    const pct = (n: number) => `${Math.round((n / rs.length) * 100)}%`;
    md.push(`| ${tier} | \`${NEMOTRON[tier]}\` | ${pct(rs.filter((r) => r.pass1).length)} | ${pct(rs.filter((r) => r.passRepair).length)} | ${(rs.reduce((a, r) => a + r.ms, 0) / rs.length / 1000).toFixed(1)} | ${rs.reduce((a, r) => a + r.costUsd, 0).toFixed(4)} |`);
  }
  const out = process.env.BENCH_OUT_DIR || "bench";
  await writeFile(`${out}/results.json`, JSON.stringify({ at: new Date().toISOString(), tasks: TASKS.length, rows }, null, 2));
  await writeFile(`${out}/results.md`, md.join("\n") + "\n");
  console.log(md.join("\n"));
}

void main();
