import { createServerFn } from "@tanstack/react-start";
import type { ComplianceOut, Design, GreenOut, PipelineOut, Plan, SecurityOut, TestOut } from "./contracts";

export type AgentStepResult = {
  agent: "Planner" | "Architect" | "Coder" | "Tester" | "Security" | "Compliance" | "Pipeline" | "GreenOps";
  status: "ok" | "warn" | "fail" | "skipped";
  summary: string;
  evidence?: string;
  model?: string;
  costUsd?: number;
  tokens?: number;
  ms: number;
};
export type MeridianResult = {
  steps: AgentStepResult[];
  plan: Plan | null;
  design: Design | null;
  files: Record<string, string>;
  changed: string[];
  test: TestOut | null;
  security: SecurityOut | null;
  compliance: ComplianceOut | null;
  pipeline: PipelineOut | null;
  green: GreenOut | null;
  deployReady: boolean;
};

/** Idea -> deploy-ready: Planner -> Architect -> Coder -> Tester -> Security -> Compliance -> Pipeline -> GreenOps. */
export const ideaToDeployReady = createServerFn({ method: "POST" })
  .validator((input: { idea: string; files: Record<string, string> }) => input)
  .handler(async ({ data }): Promise<MeridianResult> => {
    await (await import("../pcm/dna.server")).enterGrounding(data.files);
    const C = await import("./contracts");
    const { scanSecurity } = await import("./security");
    const { checkCompliance } = await import("./compliance");
    const { generateWorkflow } = await import("./cicd");
    const G = await import("./greenops");
    const core = await import("../agent/loop-core");
    const { nebiusChat } = await import("../agent/llm.server");
    const { tierModel, ROLE_TIER } = await import("../agent/nebius");
    const env = process.env;
    const hasKey = !!env.NEBIUS_API_KEY;

    const files: Record<string, string> = {};
    for (const [p, c] of Object.entries(data.files ?? {}).slice(0, 80)) {
      const s = core.safeRelPath(p);
      if (s && typeof c === "string") files[s] = c.slice(0, 200_000);
    }
    const before = { ...files };
    const usage: { model: string; tokens: number }[] = [];
    let sandboxMs = 0;
    const steps: AgentStepResult[] = [];
    const res: MeridianResult = { steps, plan: null, design: null, files, changed: [], test: null, security: null, compliance: null, pipeline: null, green: null, deployReady: false };
    const idea = (data.idea ?? "").slice(0, 6000);
    const listing = () => Object.entries(files).map(([p, c]) => `--- ${p}\n${c.slice(0, 4000)}`).join("\n").slice(0, 40_000);
    const ask = async (role: "planner" | "architect" | "implementer" | "security", system: string, user: string, maxTokens: number) => {
      const model = tierModel(ROLE_TIER[role], env);
      const r = await nebiusChat({ model, maxTokens, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
      const tokens = (r.usage.prompt_tokens ?? 0) + (r.usage.completion_tokens ?? 0);
      usage.push({ model, tokens });
      return { ...r, tokens };
    };

    // 1-3: LLM agents (need Nemotron)
    if (!hasKey || !idea.trim()) {
      const why = !hasKey ? "NEBIUS_API_KEY not set" : "No idea given";
      for (const a of ["Planner", "Architect", "Coder"] as const) steps.push({ agent: a, status: "skipped", summary: `${why}; downstream agents run on the current workspace.`, ms: 0 });
    } else {
      try {
        const r = await ask("planner", 'You are the Planner. Decompose the idea. Reply ONLY JSON: {"summary":"...","tasks":[{"id":"T1","title":"...","acceptance":["..."],"estimate":"S|M|L"}]}', `Idea: ${idea}\n\nExisting files: ${Object.keys(files).join(", ") || "(empty)"}`, 1500);
        res.plan = C.normalizePlan(C.parseJsonObject(r.text));
        steps.push({ agent: "Planner", status: "ok", summary: `${res.plan.tasks.length} tasks`, evidence: res.plan.tasks.map((t) => `${t.id} [${t.estimate}] ${t.title}\n   - ${t.acceptance.join("\n   - ")}`).join("\n"), model: r.model, costUsd: r.costUsd, tokens: r.tokens, ms: r.ms });
        const d = await ask("architect", 'You are the Architect. Produce an Architecture Decision Record. Reply ONLY JSON: {"adr":"markdown ADR","files":[{"path":"rel/path","purpose":"..."}],"interfaces":["function/type signatures"]}', `Plan: ${JSON.stringify(res.plan)}\n\nWorkspace:\n${listing()}`, 2500);
        res.design = C.normalizeDesign(C.parseJsonObject(d.text));
        steps.push({ agent: "Architect", status: "ok", summary: `ADR + ${res.design.files.length} files, ${res.design.interfaces.length} interfaces`, evidence: `${res.design.adr}\n\n${res.design.files.map((f) => `${f.path}: ${f.purpose}`).join("\n")}\n\n${res.design.interfaces.join("\n")}`, model: d.model, costUsd: d.costUsd, tokens: d.tokens, ms: d.ms });
        const c = await ask("implementer", 'You are the Coder. Implement the design, including tests runnable with `npm test` (node:test) or pytest. Reply ONLY JSON: {"notes":"...","files":[{"path":"rel/path","content":"FULL file"}]}', `Plan: ${JSON.stringify(res.plan)}\nDesign: ${JSON.stringify(res.design)}\n\nWorkspace:\n${listing()}`, 8000);
        const parsed = core.parseRepairJson(c.text);
        for (const f of parsed.files) files[f.path] = f.content;
        steps.push({ agent: "Coder", status: parsed.files.length ? "ok" : "warn", summary: `${parsed.files.length} files written`, evidence: parsed.note, model: c.model, costUsd: c.costUsd, tokens: c.tokens, ms: c.ms });
      } catch (e) {
        steps.push({ agent: steps.length === 0 ? "Planner" : steps.length === 1 ? "Architect" : "Coder", status: "fail", summary: `Contract violation or API error: ${(e as Error).message}`, ms: 0 });
      }
    }

    // 4: Tester (sandbox, with one Ultra repair attempt via the existing loop)
    const command = core.detectTestCommand(files);
    if (!command) {
      steps.push({ agent: "Tester", status: "skipped", summary: "No test command detected (needs package.json test script or pytest files).", ms: 0 });
    } else {
      const { execInSandbox, pickRunner } = await import("../agent/sandbox.server");
      const t0 = Date.now();
      const outcome = await core.runRepairLoop(
        { files, command, maxAttempts: hasKey ? 2 : 1 },
        {
          exec: async (f, cmd) => {
            const r = await execInSandbox(f, cmd);
            sandboxMs += r.ms;
            return r;
          },
          repair: async ({ files: cur, output }) => {
            const model = tierModel("ultra", env);
            const r = await nebiusChat({ model, maxTokens: 4000, temperature: 0.1, messages: [
              { role: "system", content: 'Tests failed. Fix the source. Reply ONLY JSON: {"note":"...","files":[{"path":"rel/path","content":"FULL file"}]}' },
              { role: "user", content: `Failure:\n${output}\n\n${Object.entries(cur).map(([p, c]) => `--- ${p}\n${c.slice(0, 5000)}`).join("\n").slice(0, 50_000)}` },
            ] });
            const tokens = (r.usage.prompt_tokens ?? 0) + (r.usage.completion_tokens ?? 0);
            usage.push({ model, tokens });
            const p = core.parseRepairJson(r.text);
            return { files: p.files, note: p.note, model: r.model, costUsd: r.costUsd, tokens };
          },
        },
      );
      Object.assign(files, outcome.files);
      const last = [...outcome.steps].reverse().find((s) => s.kind === "run");
      res.test = { command, exitCode: last?.exitCode ?? null, passed: outcome.passed, output: last?.output ?? "", runner: pickRunner(), ms: Date.now() - t0 };
      steps.push({ agent: "Tester", status: outcome.passed ? "ok" : "fail", summary: `\`${command}\` ${outcome.passed ? "passed" : "failed"} after ${outcome.attempts} run(s) on ${pickRunner()} runner`, evidence: res.test.output, ms: res.test.ms });
    }

    // 5: Security
    res.security = scanSecurity(files);
    const sec = res.security;
    let secNotes = "";
    let secModel: string | undefined;
    let secCost: number | undefined;
    if (hasKey && sec.findings.length) {
      try {
        const r = await ask("security", "You are the Security agent. Triage these static-scan findings: mark likely false positives, give a one-line fix for each real one. Max 8 bullets.", JSON.stringify(sec.findings.slice(0, 30)), 900);
        secNotes = `\n\nNemotron triage:\n${r.text}`;
        secModel = r.model;
        secCost = r.costUsd;
      } catch { /* triage optional */ }
    }
    steps.push({ agent: "Security", status: sec.blocking ? "fail" : sec.findings.length ? "warn" : "ok", summary: `${sec.findings.length} findings (${sec.findings.filter((f) => f.severity === "critical" || f.severity === "high").length} critical/high)`, evidence: sec.findings.map((f) => `[${f.severity}] ${f.owasp} · ${f.file}:${f.line} ${f.message}\n    ${f.snippet}`).join("\n") + secNotes || "No findings.", model: secModel, costUsd: secCost, ms: 0 });

    // 6: Pipeline (before Compliance so SOC2 CC8.1 sees the generated workflow)
    res.pipeline = generateWorkflow(files);
    const hadCi = Object.keys(files).some((p) => p.startsWith(".github/workflows/"));
    if (!hadCi) files[res.pipeline.path] = res.pipeline.yaml;
    // 7: Compliance
    res.compliance = checkCompliance(files, sec);
    steps.push({ agent: "Compliance", status: res.compliance.failing ? "warn" : "ok", summary: `${res.compliance.failing} failing controls of ${res.compliance.controls.filter((c) => c.status !== "n/a").length} applicable`, evidence: res.compliance.controls.map((c) => `${c.status.toUpperCase().padEnd(4)} ${c.framework} ${c.control}: ${c.evidence}`).join("\n"), ms: 0 });
    steps.push({ agent: "Pipeline", status: "ok", summary: `${hadCi ? "Existing CI kept; proposed" : "Generated"} ${res.pipeline.path} with jobs ${res.pipeline.jobs.join(", ")}`, evidence: res.pipeline.yaml, ms: 0 });

    // 8: GreenOps
    res.green = G.estimateGreen(usage, sandboxMs, G.assumptionsFromEnv(env));
    steps.push({ agent: "GreenOps", status: "ok", summary: `${res.green.totals.tokens} tokens measured · est. ${(res.green.totals.kWh * 1000).toFixed(3)} Wh · est. ${res.green.totals.gCO2.toFixed(3)} gCO2e`, evidence: [...res.green.llm.map((l) => `${l.model}: ${l.tokens} tok, ${l.activeParamsB}B active, ${(l.kWh * 1000).toFixed(4)} Wh`), `sandbox: ${res.green.sandboxSeconds.toFixed(1)} s`, "", ...res.green.assumptions].join("\n"), ms: 0 });

    res.changed = Object.keys(files).filter((p) => before[p] !== files[p]);
    res.deployReady = !!res.test?.passed && !sec.blocking && res.compliance.controls.every((c) => c.status !== "fail" || c.framework !== "SOC2" || c.control.startsWith("CC8"));
    return res;
  });
