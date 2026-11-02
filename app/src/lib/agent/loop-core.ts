// Pure write -> run -> test -> repair loop. Executor and repairer are injected,
// so this runs identically against Vercel Sandbox, a local process, or tests.

export type LoopFiles = Record<string, string>;

export type ExecResult = { exitCode: number; stdout: string; stderr: string; ms: number; runner: string };

export type RepairResult = {
  files: { path: string; content: string }[];
  note: string;
  model: string;
  costUsd: number;
  tokens: number;
};

export type EvidenceStep =
  | { kind: "run"; attempt: number; command: string; exitCode: number; output: string; ms: number; runner: string }
  | { kind: "repair"; attempt: number; model: string; note: string; paths: string[]; costUsd: number; tokens: number }
  | { kind: "error"; attempt: number; message: string };

export type LoopOutcome = {
  passed: boolean;
  attempts: number;
  steps: EvidenceStep[];
  files: LoopFiles;
  changed: string[];
  costUsd: number;
};

export type LoopDeps = {
  exec: (files: LoopFiles, command: string) => Promise<ExecResult>;
  repair: (ctx: { files: LoopFiles; command: string; output: string; attempt: number }) => Promise<RepairResult>;
};

const MAX_OUTPUT = 4000;

export function tail(s: string, max = MAX_OUTPUT) {
  return s.length > max ? `…${s.slice(-max)}` : s;
}

export function safeRelPath(p: string): string | null {
  const clean = p.replace(/\\/g, "/").replace(/^\.?\/+/, "");
  if (!clean || clean.split("/").some((seg) => seg === ".." || seg === "")) return null;
  if (/^(node_modules|\.git)\//.test(clean)) return null;
  return clean;
}

export async function runRepairLoop(
  input: { files: LoopFiles; command: string; maxAttempts?: number },
  deps: LoopDeps,
): Promise<LoopOutcome> {
  const maxAttempts = Math.min(Math.max(input.maxAttempts ?? 3, 1), 6);
  let files = { ...input.files };
  const changed = new Set<string>();
  const steps: EvidenceStep[] = [];
  let cost = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let run: ExecResult;
    try {
      run = await deps.exec(files, input.command);
    } catch (err) {
      steps.push({ kind: "error", attempt, message: err instanceof Error ? err.message : String(err) });
      return { passed: false, attempts: attempt, steps, files, changed: [...changed], costUsd: cost };
    }
    const output = tail(`${run.stdout}\n${run.stderr}`.trim());
    steps.push({ kind: "run", attempt, command: input.command, exitCode: run.exitCode, output, ms: run.ms, runner: run.runner });
    if (run.exitCode === 0) {
      return { passed: true, attempts: attempt, steps, files, changed: [...changed], costUsd: cost };
    }
    if (attempt === maxAttempts) break;

    try {
      const fix = await deps.repair({ files, command: input.command, output, attempt });
      cost += fix.costUsd;
      const paths: string[] = [];
      for (const f of fix.files) {
        const p = safeRelPath(f.path);
        if (!p || typeof f.content !== "string") continue;
        files = { ...files, [p]: f.content };
        changed.add(p);
        paths.push(p);
      }
      steps.push({ kind: "repair", attempt, model: fix.model, note: fix.note, paths, costUsd: fix.costUsd, tokens: fix.tokens });
      if (!paths.length) break;
    } catch (err) {
      steps.push({ kind: "error", attempt, message: err instanceof Error ? err.message : String(err) });
      break;
    }
  }
  return { passed: false, attempts: steps.filter((s) => s.kind === "run").length, steps, files, changed: [...changed], costUsd: cost };
}

/** Extract `{ "files": [...], "note": "..." }` from a model reply (tolerates fences / prose). */
export function parseRepairJson(text: string): { files: { path: string; content: string }[]; note: string } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const obj = JSON.parse(c) as { files?: unknown; note?: unknown };
      const files = Array.isArray(obj.files)
        ? obj.files.filter(
            (f): f is { path: string; content: string } =>
              !!f && typeof (f as { path?: unknown }).path === "string" && typeof (f as { content?: unknown }).content === "string",
          )
        : [];
      return { files, note: typeof obj.note === "string" ? obj.note : "" };
    } catch {
      /* try next */
    }
  }
  return { files: [], note: "Model reply was not valid JSON." };
}

/** Pick the test command for a workspace, or null if nothing is testable. */
export function detectTestCommand(files: LoopFiles): string | null {
  const pkg = files["package.json"];
  if (pkg) {
    try {
      const j = JSON.parse(pkg) as { scripts?: Record<string, string> };
      if (j.scripts?.test) return "npm test --silent";
    } catch {
      /* ignore */
    }
  }
  if (Object.keys(files).some((p) => /(^|\/)test_.*\.py$|_test\.py$/.test(p))) return "python3 -m pytest -q";
  return null;
}
