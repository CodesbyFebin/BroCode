// Workflow executor: walks the DAG from start, following condition branches. Effects are injected.
import { evalCondition, render, validateWorkflow, type ToolName, type WfNode, type Workflow } from "./schema";

export type WfDeps = {
  llm: (prompt: string, tier: "nano" | "super" | "ultra") => Promise<{ text: string; model: string; costUsd?: number }>;
  tool: (name: ToolName, files: Record<string, string>, node: WfNode, vars: Record<string, string>) => Promise<string>;
  check: (command: string, files: Record<string, string>) => Promise<{ exitCode: number; output: string }>;
};
export type WfStep = { node: string; type: WfNode["type"]; status: "ok" | "fail" | "skipped"; output: string; ms: number; model?: string; costUsd?: number };
export type WfResult = { ok: boolean; errors: string[]; steps: WfStep[]; vars: Record<string, string>; files: Record<string, string> };

export async function runWorkflow(w: Workflow, input: string, files: Record<string, string>, deps: WfDeps, maxSteps = 50): Promise<WfResult> {
  const errors = validateWorkflow(w);
  const vars: Record<string, string> = { input };
  const steps: WfStep[] = [];
  const work = { ...files };
  if (errors.length) return { ok: false, errors, steps, vars, files: work };
  const byId = new Map(w.nodes.map((n) => [n.id, n]));
  // Execute in topological order, only nodes reachable through taken edges.
  const active = new Set<string>([w.nodes.find((n) => n.type === "start")!.id]);
  const order = topo(w);
  let ok = true;
  for (const id of order) {
    if (steps.length >= maxSteps) { errors.push("step limit reached"); ok = false; break; }
    const n = byId.get(id)!;
    if (!active.has(id)) { steps.push({ node: id, type: n.type, status: "skipped", output: "", ms: 0 }); continue; }
    const t = Date.now();
    let status: WfStep["status"] = "ok";
    let output = "";
    let model: string | undefined;
    let costUsd: number | undefined;
    let branch: "true" | "false" | undefined;
    try {
      if (n.type === "llm") {
        const r = await deps.llm(render(n.config!.prompt!, vars), n.config?.tier ?? "super");
        output = r.text; model = r.model; costUsd = r.costUsd;
      } else if (n.type === "tool") {
        output = await deps.tool(n.config!.tool!, work, n, vars);
        if (n.config!.tool === "write-file" && n.config?.path) work[n.config.path] = output;
      } else if (n.type === "check") {
        const r = await deps.check(n.config!.command!, work);
        output = `exit ${r.exitCode}\n${r.output}`;
        vars[`${n.id}_exit`] = String(r.exitCode);
        if (r.exitCode !== 0) { status = "fail"; ok = false; }
      } else if (n.type === "condition") {
        branch = evalCondition(n.config!.expr!, vars) ? "true" : "false";
        output = branch;
      }
    } catch (e) {
      status = "fail"; ok = false; output = (e as Error).message;
    }
    const outVar = n.config?.output ?? n.id;
    vars[outVar] = output;
    // Flatten top-level JSON primitives so conditions can test e.g. security.blocking == "true".
    if (n.type === "tool") {
      try {
        const o = JSON.parse(output) as unknown;
        if (o && typeof o === "object" && !Array.isArray(o)) {
          for (const [k, v] of Object.entries(o)) if (v === null || typeof v !== "object") vars[`${outVar}.${k}`] = String(v);
        }
      } catch { /* not JSON */ }
    }
    steps.push({ node: id, type: n.type, status, output: output.slice(0, 20_000), ms: Date.now() - t, model, costUsd });
    if (status === "fail") break;
    for (const e of w.edges.filter((x) => x.from === id)) {
      if (n.type !== "condition" || e.when === branch) active.add(e.to);
    }
  }
  return { ok, errors, steps, vars, files: work };
}

function topo(w: Workflow): string[] {
  const indeg = new Map(w.nodes.map((n) => [n.id, 0]));
  for (const e of w.edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const q = w.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const out: string[] = [];
  while (q.length) {
    const id = q.shift()!;
    out.push(id);
    for (const e of w.edges.filter((x) => x.from === id)) {
      indeg.set(e.to, indeg.get(e.to)! - 1);
      if (indeg.get(e.to) === 0) q.push(e.to);
    }
  }
  return out;
}
