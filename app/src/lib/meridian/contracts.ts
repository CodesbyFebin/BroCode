// Fixed contracts passed between MERIDIAN-style agents. Each agent consumes the previous outputs.
export type Plan = { summary: string; tasks: { id: string; title: string; acceptance: string[]; estimate: "S" | "M" | "L" }[] };
export type Design = { adr: string; files: { path: string; purpose: string }[]; interfaces: string[] };
export type CodeOut = { files: Record<string, string>; notes: string };
export type TestOut = { command: string | null; exitCode: number | null; passed: boolean; output: string; runner: string | null; ms: number };
export type Severity = "critical" | "high" | "medium" | "low";
export type SecurityFinding = { id: string; owasp: string; severity: Severity; file: string; line: number; message: string; snippet: string };
export type SecurityOut = { findings: SecurityFinding[]; blocking: boolean };
export type Control = { framework: "GDPR" | "HIPAA" | "SOC2"; control: string; status: "pass" | "fail" | "n/a"; evidence: string };
export type ComplianceOut = { controls: Control[]; failing: number };
export type PipelineOut = { path: string; yaml: string; jobs: string[] };
export type GreenOut = {
  llm: { model: string; tokens: number; activeParamsB: number; flops: number; kWh: number; gCO2: number }[];
  sandboxSeconds: number;
  totals: { tokens: number; kWh: number; gCO2: number };
  assumptions: string[];
};

export function parseJsonObject<T>(text: string): T {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no JSON object in model output");
  return JSON.parse(text.slice(a, b + 1)) as T;
}

export function normalizePlan(raw: unknown): Plan {
  const o = (raw ?? {}) as Partial<Plan>;
  if (!Array.isArray(o.tasks) || !o.tasks.length) throw new Error("Plan contract: tasks[] required");
  return {
    summary: String(o.summary ?? ""),
    tasks: o.tasks.slice(0, 12).map((t, i) => ({
      id: String(t.id ?? `T${i + 1}`),
      title: String(t.title ?? ""),
      acceptance: Array.isArray(t.acceptance) ? t.acceptance.map(String).slice(0, 6) : [],
      estimate: (["S", "M", "L"].includes(t.estimate as string) ? t.estimate : "M") as "S" | "M" | "L",
    })),
  };
}

export function normalizeDesign(raw: unknown): Design {
  const o = (raw ?? {}) as Partial<Design>;
  if (!o.adr || !Array.isArray(o.files)) throw new Error("Design contract: adr and files[] required");
  return {
    adr: String(o.adr),
    files: o.files.slice(0, 30).map((f) => ({ path: String(f.path), purpose: String(f.purpose ?? "") })),
    interfaces: Array.isArray(o.interfaces) ? o.interfaces.map(String).slice(0, 20) : [],
  };
}
