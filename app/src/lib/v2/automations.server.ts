// Server wiring: automations are loaded from BROCODE_AUTOMATIONS (JSON file path) and run workflows with live deps.
import { readFileSync } from "node:fs";
import { Scheduler, validateAutomation, type Automation } from "./automations";
import { EXAMPLE_WORKFLOW, type Workflow } from "../workflow/schema";

let scheduler: Scheduler | undefined;
const WORKFLOWS: Record<string, Workflow> = { [EXAMPLE_WORKFLOW.id]: EXAMPLE_WORKFLOW, example: EXAMPLE_WORKFLOW };

export function getScheduler(): Scheduler {
  if (scheduler) return scheduler;
  const path = process.env.BROCODE_AUTOMATIONS;
  const list: Automation[] = path ? (JSON.parse(readFileSync(path, "utf8")) as Automation[]) : [];
  for (const a of list) { const e = validateAutomation(a); if (e.length) throw new Error(`automation ${a.id}: ${e.join("; ")}`); }
  scheduler = new Scheduler(list, async (a, input) => {
    const wf = WORKFLOWS[a.workflowId];
    if (!wf) return { ok: false, summary: `workflow ${a.workflowId} not found` };
    const { runWorkflow } = await import("../workflow/engine");
    const { liveDeps } = await import("../workflow/deps.server");
    const r = await runWorkflow(wf, input, {}, liveDeps());
    return { ok: r.ok, summary: r.steps.map((s) => `${s.node}:${s.status}`).join(" ") };
  });
  return scheduler;
}
