// Coding-Agent workflow format (own design; inspired by visual workflow builders such as Dify's,
// no code copied). A workflow is a DAG of typed nodes; edges from a condition node carry when=true|false.
export type NodeType = "start" | "llm" | "tool" | "check" | "condition" | "end";
export type ToolName = "security-scan" | "compliance" | "write-file";

export type WfNode = {
  id: string;
  type: NodeType;
  label?: string;
  x?: number;
  y?: number;
  /** llm: prompt template with {{var}}; tool: tool name; check: sandbox command; condition: expression. */
  config?: { prompt?: string; tier?: "nano" | "super" | "ultra"; tool?: ToolName; command?: string; expr?: string; output?: string; path?: string };
};
export type WfEdge = { from: string; to: string; when?: "true" | "false" };
export type Workflow = { id: string; name: string; version: number; nodes: WfNode[]; edges: WfEdge[] };

const ID = /^[a-z][a-z0-9_-]{0,39}$/;
const TOOLS: ToolName[] = ["security-scan", "compliance", "write-file"];

export function validateWorkflow(w: Workflow): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const n of w.nodes ?? []) {
    if (!ID.test(n.id)) errs.push(`bad node id "${n.id}"`);
    if (ids.has(n.id)) errs.push(`duplicate node id "${n.id}"`);
    ids.add(n.id);
    if (n.type === "llm" && !n.config?.prompt) errs.push(`llm node "${n.id}" needs a prompt`);
    if (n.type === "tool" && !TOOLS.includes(n.config?.tool as ToolName)) errs.push(`tool node "${n.id}" needs one of ${TOOLS.join(", ")}`);
    if (n.type === "check" && !n.config?.command) errs.push(`check node "${n.id}" needs a command`);
    if (n.type === "condition" && !n.config?.expr) errs.push(`condition node "${n.id}" needs an expr`);
  }
  const starts = (w.nodes ?? []).filter((n) => n.type === "start");
  if (starts.length !== 1) errs.push("workflow needs exactly one start node");
  if (!(w.nodes ?? []).some((n) => n.type === "end")) errs.push("workflow needs an end node");
  for (const e of w.edges ?? []) {
    if (!ids.has(e.from) || !ids.has(e.to)) errs.push(`edge ${e.from}->${e.to} references a missing node`);
  }
  for (const n of (w.nodes ?? []).filter((x) => x.type === "condition")) {
    const out = w.edges.filter((e) => e.from === n.id);
    if (!out.some((e) => e.when === "true") || !out.some((e) => e.when === "false")) errs.push(`condition "${n.id}" needs a true and a false edge`);
  }
  if (!errs.length && hasCycle(w)) errs.push("workflow has a cycle");
  return errs;
}

function hasCycle(w: Workflow): boolean {
  const state = new Map<string, 1 | 2>();
  const out = (id: string) => w.edges.filter((e) => e.from === id).map((e) => e.to);
  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const t of out(id)) if (visit(t)) return true;
    state.set(id, 2);
    return false;
  };
  return w.nodes.some((n) => visit(n.id));
}

/** {{var}} interpolation; unknown vars become empty. */
export function render(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

/**
 * Safe condition language (no eval): `var contains "text"`, `var == "text"`, `var != "text"`,
 * `var > 3`, `var < 3`, `var empty`, `var not empty`.
 */
export function evalCondition(expr: string, vars: Record<string, string>): boolean {
  const m = /^\s*([a-zA-Z_][\w.]*)\s+(contains|==|!=|>|<|empty|not empty)\s*(?:"([^"]*)"|(-?\d+(?:\.\d+)?))?\s*$/.exec(expr);
  if (!m) throw new Error(`invalid condition: ${expr}`);
  const v = vars[m[1]] ?? "";
  const lit = m[3] ?? m[4] ?? "";
  switch (m[2]) {
    case "contains": return v.includes(lit);
    case "==": return v === lit;
    case "!=": return v !== lit;
    case ">": return Number(v) > Number(lit);
    case "<": return Number(v) < Number(lit);
    case "empty": return v.trim() === "";
    default: return v.trim() !== "";
  }
}

export const EXAMPLE_WORKFLOW: Workflow = {
  id: "fix-and-verify",
  name: "Fix, scan and verify",
  version: 1,
  nodes: [
    { id: "start", type: "start", x: 40, y: 120 },
    { id: "plan", type: "llm", label: "Plan (Ultra)", x: 200, y: 120, config: { tier: "ultra", prompt: "Plan the change for: {{input}}", output: "plan" } },
    { id: "scan", type: "tool", label: "Security scan", x: 380, y: 120, config: { tool: "security-scan", output: "security" } },
    { id: "gate", type: "condition", label: "Blocking findings?", x: 560, y: 120, config: { expr: 'security.blocking == "true"' } },
    { id: "test", type: "check", label: "Run tests", x: 740, y: 60, config: { command: "npm test", output: "tests" } },
    { id: "explain", type: "llm", label: "Explain (Nano)", x: 740, y: 190, config: { tier: "nano", prompt: "Explain these findings briefly: {{security}}", output: "explanation" } },
    { id: "end", type: "end", x: 920, y: 120 },
  ],
  edges: [
    { from: "start", to: "plan" },
    { from: "plan", to: "scan" },
    { from: "scan", to: "gate" },
    { from: "gate", to: "explain", when: "true" },
    { from: "gate", to: "test", when: "false" },
    { from: "test", to: "end" },
    { from: "explain", to: "end" },
  ],
};
