import { createServerFn } from "@tanstack/react-start";
import type { ProjectDNA } from "../pcm/dna";
import type { DiffReview } from "./diff";
import type { CiAnalysis } from "./cilog";
import type { ConfigFinding } from "./configaudit";

type LlmTrace = { role: string; model: string; costUsd: number; ms: number };
const hasKey = () => !!process.env.NEBIUS_API_KEY;

async function ask(tier: "nano" | "super" | "ultra", system: string, user: string, maxTokens: number, trace: LlmTrace[], role: string) {
  const { nebiusChat } = await import("../agent/llm.server");
  const { tierModel } = await import("../agent/nebius");
  const r = await nebiusChat({ model: tierModel(tier, process.env), maxTokens, temperature: 0.1, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
  trace.push({ role, model: r.model, costUsd: r.costUsd, ms: r.ms });
  return r.text.trim();
}

/** PCM: passive DNA extraction + persistence (also happens automatically in every workspace server fn). */
export const extractProjectDNA = createServerFn({ method: "POST" })
  .validator((input: { files: Record<string, string> }) => input)
  .handler(async ({ data }): Promise<{ dna: ProjectDNA | null; prompt: string }> => {
    const { enterGrounding } = await import("../pcm/dna.server");
    const { dnaPrompt } = await import("../pcm/dna");
    const dna = await enterGrounding(data.files);
    return { dna, prompt: dna ? dnaPrompt(dna) : "" };
  });

export const getProjectDNA = createServerFn({ method: "GET" }).handler(async (): Promise<{ dna: ProjectDNA | null; prompt: string }> => {
  const { loadDNA } = await import("../pcm/dna.server");
  const { dnaPrompt } = await import("../pcm/dna");
  const dna = await loadDNA();
  return { dna, prompt: dna ? dnaPrompt(dna) : "" };
});

/** CI Whisperer: PR diff review — rules + Security agent, then Nano triage and Super analysis. */
export const reviewPullRequest = createServerFn({ method: "POST" })
  .validator((input: { diff?: string; repo?: string; pr?: number; files?: Record<string, string> }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string; review?: DiffReview; markdown: string; trace: LlmTrace[] }> => {
    await (await import("../pcm/dna.server")).enterGrounding(data.files);
    const { reviewDiff, reviewMarkdown } = await import("./diff");
    const trace: LlmTrace[] = [];
    let diff = data.diff ?? "";
    try {
      if (!diff && data.repo && data.pr) diff = await (await import("./github.server")).fetchPrDiff(data.repo, data.pr);
    } catch (e) {
      return { ok: false, error: `gh pr diff failed: ${(e as Error).message}`, markdown: "", trace };
    }
    if (!diff.trim()) return { ok: false, error: "Paste a unified diff or give repo + PR number.", markdown: "", trace };
    diff = diff.slice(0, 400_000);
    const review = reviewDiff(diff);
    let triage: string | undefined, analysis: string | undefined;
    if (hasKey()) {
      try {
        triage = await ask("nano", "You are a fast PR triage reviewer. Given rule-based findings and the diff, list at most 5 that truly matter (mark likely false positives) as short bullets. No preamble.", `Findings:\n${JSON.stringify(review.findings.slice(0, 40))}\n\nDiff:\n${diff.slice(0, 24_000)}`, 600, trace, "triage (Nano)");
        analysis = await ask("super", "You are a senior reviewer. From the diff, report: (1) likely bugs with file:line, (2) risks (security, data, perf, breaking API), (3) missing tests — name the exact test cases to add. Bullets only; say 'none' for empty sections. Do not invent files.", diff.slice(0, 60_000), 1400, trace, "analysis (Super)");
      } catch (e) {
        analysis = `_Nemotron call failed: ${(e as Error).message}_`;
      }
    }
    return { ok: true, review, markdown: reviewMarkdown(review, { triage, analysis, models: trace.map((t) => t.model) }), trace };
  });

/** CI Whisperer: failure log analysis with a suggested fix (Super). */
export const explainCiFailure = createServerFn({ method: "POST" })
  .validator((input: { log?: string; repo?: string; runId?: number; files?: Record<string, string> }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean; error?: string; analysis?: CiAnalysis; markdown: string; trace: LlmTrace[] }> => {
    await (await import("../pcm/dna.server")).enterGrounding(data.files);
    const { analyzeCiLog, ciMarkdown } = await import("./cilog");
    const trace: LlmTrace[] = [];
    let log = data.log ?? "";
    try {
      if (!log && data.repo && data.runId) log = await (await import("./github.server")).fetchFailedRunLog(data.repo, data.runId);
    } catch (e) {
      return { ok: false, error: `gh run view failed: ${(e as Error).message}`, markdown: "", trace };
    }
    if (!log.trim()) return { ok: false, error: "Paste a failing log or give repo + run id.", markdown: "", trace };
    const analysis = analyzeCiLog(log.slice(-400_000));
    let explanation: string | undefined;
    if (hasKey()) {
      try {
        explanation = await ask("super", "You explain CI failures. Given parsed failure signals and the log tail, state the root cause in one sentence, then the minimal fix (exact file/line/command when known). Never guess file contents you were not shown.", `Signals:\n${JSON.stringify(analysis.failures)}\n\nLog tail:\n${log.slice(-12_000)}`, 900, trace, "explain (Super)");
      } catch (e) {
        explanation = `_Nemotron call failed: ${(e as Error).message}_`;
      }
    }
    return { ok: true, analysis, markdown: ciMarkdown(analysis, { explanation, model: trace[0]?.model }), trace };
  });

/**
 * PCM CI auto-healing: parse the failing log, reproduce in the sandbox, let Ultra
 * propose a fix through the existing repair loop, and only return a patch when
 * the sandbox run passes. (Idea credit: adeshukla/pare — "write nothing unless the
 * before/after check passes".)
 */
export const healCiFailure = createServerFn({ method: "POST" })
  .validator((input: { files: Record<string, string>; log: string; command?: string }) => input)
  .handler(async ({ data }) => {
    await (await import("../pcm/dna.server")).enterGrounding(data.files);
    const core = await import("../agent/loop-core");
    const { analyzeCiLog } = await import("./cilog");
    const { unifiedDiff } = await import("./patch");
    const analysis = analyzeCiLog((data.log ?? "").slice(-400_000));
    const files: Record<string, string> = {};
    for (const [p, c] of Object.entries(data.files ?? {}).slice(0, 120)) {
      const s = core.safeRelPath(p);
      if (s && typeof c === "string") files[s] = c.slice(0, 200_000);
    }
    const command = data.command?.trim() || core.detectTestCommand(files);
    if (!hasKey()) return { ok: false as const, error: "NEBIUS_API_KEY not set; auto-heal needs Nemotron Ultra.", analysis, patch: "", steps: [], verified: false, command };
    if (!command) return { ok: false as const, error: "No test command detected to verify a fix in the sandbox.", analysis, patch: "", steps: [], verified: false, command };
    const { execInSandbox } = await import("../agent/sandbox.server");
    const { nebiusChat } = await import("../agent/llm.server");
    const { tierModel } = await import("../agent/nebius");
    const outcome = await core.runRepairLoop(
      { files, command, maxAttempts: Number(process.env.REPAIR_MAX_ATTEMPTS) || 3 },
      {
        exec: (f, cmd) => execInSandbox(f, cmd),
        repair: async ({ files: cur, output }) => {
          const model = tierModel("ultra", process.env);
          const r = await nebiusChat({ model, maxTokens: 6000, temperature: 0.1, messages: [
            { role: "system", content: 'You heal failing CI. Make the smallest precise change that fixes the root cause; never delete or skip tests, never add @ts-ignore. Reply ONLY JSON: {"note":"root cause + fix","files":[{"path":"rel/path","content":"FULL file"}]}' },
            { role: "user", content: `CI failure signals:\n${JSON.stringify(analysis.failures.slice(0, 6))}\n\nSandbox output:\n${output}\n\nFiles:\n${Object.entries(cur).map(([p, c]) => `--- ${p}\n${c.slice(0, 6000)}`).join("\n").slice(0, 60_000)}` },
          ] });
          const p = core.parseRepairJson(r.text);
          return { files: p.files, note: p.note, model: r.model, costUsd: r.costUsd, tokens: (r.usage.prompt_tokens ?? 0) + (r.usage.completion_tokens ?? 0) };
        },
      },
    );
    const patch = outcome.passed ? outcome.changed.map((p) => unifiedDiff(p, files[p], outcome.files[p])).join("\n") : "";
    return {
      ok: true as const,
      analysis,
      command,
      verified: outcome.passed,
      patch,
      changedFiles: outcome.passed ? Object.fromEntries(outcome.changed.map((p) => [p, outcome.files[p]])) : {},
      steps: outcome.steps,
      attempts: outcome.attempts,
      costUsd: outcome.costUsd,
      message: outcome.passed ? (outcome.changed.length ? "Fix verified in sandbox." : "Tests already pass in the sandbox — CI failure not reproduced (environment-specific?).") : "No verified fix; nothing proposed.",
    };
  });

/** CI Whisperer: release notes from merged commits (deterministic grouping + optional Nano highlights). */
export const generateReleaseNotes = createServerFn({ method: "POST" })
  .validator((input: { commits?: { sha: string; message: string }[]; repo?: string; base?: string; head?: string; title?: string }) => input)
  .handler(async ({ data }) => {
    const { releaseNotes } = await import("./releasenotes");
    const trace: LlmTrace[] = [];
    let commits = data.commits ?? [];
    try {
      if (!commits.length && data.repo && data.base && data.head) commits = await (await import("./github.server")).fetchCommits(data.repo, data.base, data.head);
    } catch (e) {
      return { ok: false, error: `gh api compare failed: ${(e as Error).message}`, markdown: "", trace };
    }
    if (!commits.length) return { ok: false, error: "No commits.", markdown: "", trace };
    let md = releaseNotes(commits, { title: data.title, repoUrl: data.repo ? `https://github.com/${data.repo}` : undefined });
    if (hasKey()) {
      try {
        const h = await ask("nano", "Write 2-3 sentence user-facing highlights for these release notes. Only mention items present. No marketing superlatives.", md, 300, trace, "highlights (Nano)");
        md = md.replace(/\n\n/, `\n\n${h}\n\n`);
      } catch { /* optional */ }
    }
    return { ok: true, markdown: md, trace };
  });

/** CI Whisperer: security/unsafe-config audit (run on merge). */
export const auditOnMerge = createServerFn({ method: "POST" })
  .validator((input: { files: Record<string, string> }) => input)
  .handler(async ({ data }): Promise<{ findings: ConfigFinding[]; blocking: boolean }> => {
    const { auditConfig } = await import("./configaudit");
    return auditConfig(data.files ?? {});
  });
