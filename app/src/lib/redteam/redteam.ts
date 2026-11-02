import { createServerFn } from "@tanstack/react-start";
import type { Bug, Mutation } from "./types";

export type RedTeamResult = {
  ok: boolean;
  error?: string;
  sessionId?: string;
  log: Mutation[];
  bugs: Bug[];
  report: string;
  novelHypotheses: { attackClass: string; tool: string; text: string }[];
  costUsd: number;
  persisted: "pglite" | "none";
};

async function store() {
  const S = await import("./store");
  const g = globalThis as unknown as { __redagentDb__?: Promise<import("./store").Db> };
  g.__redagentDb__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(process.env.REDAGENT_DB_DIR || undefined);
    await S.migrate(db);
    return db as unknown as import("./store").Db;
  })();
  return { S, db: await g.__redagentDb__ };
}

export const runRedTeam = createServerFn({ method: "POST" })
  .validator((input: { task: string; files: Record<string, string>; maxSteps?: number }) => input)
  .handler(async ({ data }): Promise<RedTeamResult> => {
    const empty = { log: [], bugs: [], report: "", novelHypotheses: [], costUsd: 0, persisted: "none" as const };
    if (!process.env.NEBIUS_API_KEY) return { ok: false, error: "NEBIUS_API_KEY is not set; RedAgent needs Nemotron for both the mocker and the agent under test.", ...empty };
    const { nebiusChat } = await import("../agent/llm.server");
    const { tierModel } = await import("../agent/nebius");
    const { nemotronMocker } = await import("./mocker");
    const H = await import("./harness");
    const { markdownReport } = await import("./report");
    const { ATTACK_CLASSES } = await import("./types");
    let cost = 0;
    const mockModel = tierModel(process.env.REDAGENT_MOCKER_TIER === "ultra" ? "ultra" : "super", process.env);
    const agentModel = tierModel("super", process.env);
    const decide = nemotronMocker(async ({ system, user }) => {
      const r = await nebiusChat({ model: mockModel, maxTokens: 1500, temperature: 0.7, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
      return r;
    }, (c) => (cost += c));
    const step: import("./harness").AgentStep = async (t) => {
      const r = await nebiusChat({
        model: agentModel,
        maxTokens: 3000,
        temperature: 0.2,
        messages: [{ role: "system", content: H.AGENT_SYSTEM }, ...t.map((m) => ({ role: m.role === "agent" ? ("assistant" as const) : ("user" as const), content: m.content }))],
      });
      cost += r.costUsd;
      try {
        return JSON.parse(r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1));
      } catch {
        return { final: r.text };
      }
    };
    const tools: import("./harness").ToolImpls = {};
    if (process.env.TAVILY_API_KEY) {
      const { tavilySearch, researchContext } = await import("../agent/tavily");
      tools.search_web = async (q) => researchContext(await tavilySearch(q, process.env.TAVILY_API_KEY!));
    }
    const core = await import("../agent/loop-core");
    tools.run_tests = async (files) => {
      const cmd = core.detectTestCommand(files);
      if (!cmd) return "No test command detected.";
      const { execInSandbox } = await import("../agent/sandbox.server");
      const r = await execInSandbox(files, cmd);
      return `exit ${r.exitCode}\n${core.tail(r.stdout + "\n" + r.stderr, 3000)}`;
    };
    const run = await H.runHarness({ task: data.task.slice(0, 4000), files: data.files ?? {}, decide, step, tools, maxSteps: Math.min(12, data.maxSteps ?? 8) });

    const id = `ra_${Date.now().toString(36)}`;
    let novel: RedTeamResult["novelHypotheses"] = [];
    let persisted: RedTeamResult["persisted"] = "none";
    try {
      const { S, db } = await store();
      const tried = await S.coverage(db);
      const thisRun = run.log.map((m) => ({ tool: m.tool, attack_class: m.attackClass }));
      novel = await S.addHypotheses(db, S.untriedCombos(["list_files", "read_file", "search_web", "write_file", "run_tests"], [...tried, ...thisRun], ATTACK_CLASSES).slice(0, 6));
      const report = markdownReport({ id, task: data.task, model: mockModel, costUsd: cost, log: run.log, bugs: run.bugs, hypotheses: novel, finalAnswer: run.finalAnswer });
      await S.saveSession(db, { id, task: data.task, model: mockModel, costUsd: cost, report, log: run.log, bugs: run.bugs });
      persisted = "pglite";
      return { ok: true, sessionId: id, log: run.log, bugs: run.bugs, report, novelHypotheses: novel, costUsd: cost, persisted };
    } catch (e) {
      const report = markdownReport({ id, task: data.task, model: mockModel, costUsd: cost, log: run.log, bugs: run.bugs, hypotheses: [], finalAnswer: run.finalAnswer });
      return { ok: true, error: `Persistence failed: ${(e as Error).message}`, sessionId: id, log: run.log, bugs: run.bugs, report, novelHypotheses: [], costUsd: cost, persisted };
    }
  });

export const listRedTeamSessions = createServerFn({ method: "GET" }).handler(async () => {
  const { S, db } = await store();
  return S.listSessions(db);
});

/** User-triggered only: files the stored report as a GitHub issue with the gh CLI. */
export const fileRedTeamIssue = createServerFn({ method: "POST" })
  .validator((input: { sessionId: string; confirm: boolean }) => input)
  .handler(async ({ data }) => {
    if (data.confirm !== true) return { ok: false, message: "Not confirmed." };
    const repo = process.env.REDAGENT_GITHUB_REPO;
    if (!repo) return { ok: false, message: "Set REDAGENT_GITHUB_REPO (owner/name) to enable issue filing." };
    const { S, db } = await store();
    const s = await S.getSession(db, String(data.sessionId));
    if (!s) return { ok: false, message: "Session not found." };
    const { execFile } = await import("node:child_process");
    const out = await new Promise<{ ok: boolean; message: string }>((resolve) =>
      execFile("gh", ["issue", "create", "--repo", repo, "--title", `RedAgent: ${s.severities.length} exploited bug(s) in ${s.id}`, "--body", s.report.slice(0, 60_000)], { timeout: 30_000 }, (err, stdout, stderr) =>
        resolve(err ? { ok: false, message: (stderr || err.message).slice(0, 500) } : { ok: true, message: stdout.trim() }),
      ),
    );
    return out;
  });
