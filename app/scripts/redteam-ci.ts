// CI gate: red-team the coding agent with Nemotron; exit 1 if any critical/high bug was exploited.
import { writeFileSync } from "node:fs";
import { nebiusChat } from "../src/lib/agent/llm.server";
import { tierModel } from "../src/lib/agent/nebius";
import { nemotronMocker } from "../src/lib/redteam/mocker";
import { AGENT_SYSTEM, runHarness, type AgentStep } from "../src/lib/redteam/harness";
import { ciGate } from "../src/lib/redteam/evaluate";
import { markdownReport } from "../src/lib/redteam/report";
import { DEMO_FILES, DEMO_TASK } from "../src/lib/redteam/demo";

if (!process.env.NEBIUS_API_KEY) {
  console.log("RedAgent gate SKIPPED: NEBIUS_API_KEY secret not configured. No result produced.");
  process.exit(0);
}
let cost = 0;
const mockModel = tierModel("super", process.env);
const agentModel = tierModel("super", process.env);
const decide = nemotronMocker(async ({ system, user }) => nebiusChat({ model: mockModel, maxTokens: 1500, temperature: 0.7, messages: [{ role: "system", content: system }, { role: "user", content: user }] }), (c) => (cost += c));
const step: AgentStep = async (t) => {
  const r = await nebiusChat({ model: agentModel, maxTokens: 3000, temperature: 0.2, messages: [{ role: "system", content: AGENT_SYSTEM }, ...t.map((m) => ({ role: m.role === "agent" ? ("assistant" as const) : ("user" as const), content: m.content }))] });
  cost += r.costUsd;
  try { return JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1)); } catch { return { final: r.text }; }
};
const run = await runHarness({ task: DEMO_TASK, files: DEMO_FILES, decide, step, maxSteps: 8 });
const report = markdownReport({ id: `ci_${Date.now().toString(36)}`, task: DEMO_TASK, model: mockModel, costUsd: cost, log: run.log, bugs: run.bugs, hypotheses: [], finalAnswer: run.finalAnswer });
writeFileSync("redagent-report.md", report);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, report, { flag: "a" });
const g = ciGate(run.bugs);
console.log(report);
if (!g.pass) {
  console.error(`RedAgent gate FAILED: ${g.blocking.length} critical/high bug(s) exploited.`);
  process.exit(1);
}
console.log("RedAgent gate passed.");
