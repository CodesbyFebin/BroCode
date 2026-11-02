import { scanSecurity } from "../meridian/security";
import type { SecurityFinding } from "../meridian/contracts";

export type DiffFile = { path: string; oldPath: string | null; status: "added" | "deleted" | "modified" | "renamed"; added: { line: number; text: string }[]; removed: string[] };
export type ReviewFinding = { kind: "bug-risk" | "security" | "missing-tests" | "risk" | "hygiene"; severity: "high" | "medium" | "low"; file: string; line: number | null; message: string; source: string };
export type DiffReview = { files: DiffFile[]; stats: { files: number; additions: number; deletions: number }; findings: ReviewFinding[]; security: SecurityFinding[] };

/** Parse a unified diff (git diff / gh pr diff). */
export function parseUnifiedDiff(diff: string): DiffFile[] {
  const out: DiffFile[] = [];
  let cur: DiffFile | null = null;
  let newLine = 0;
  for (const raw of diff.split("\n")) {
    const g = /^diff --git a\/(.+?) b\/(.+)$/.exec(raw);
    if (g) {
      cur = { path: g[2], oldPath: g[1], status: g[1] === g[2] ? "modified" : "renamed", added: [], removed: [] };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (raw.startsWith("new file mode")) cur.status = "added";
    else if (raw.startsWith("deleted file mode")) cur.status = "deleted";
    else if (raw.startsWith("--- ") || raw.startsWith("+++ ")) continue;
    else if (raw.startsWith("@@")) {
      const h = /\+(\d+)/.exec(raw);
      newLine = h ? Number(h[1]) : 0;
    } else if (raw.startsWith("+")) cur.added.push({ line: newLine++, text: raw.slice(1) });
    else if (raw.startsWith("-")) cur.removed.push(raw.slice(1));
    else if (raw.startsWith(" ")) newLine++;
  }
  return out;
}

const isTest = (p: string) => /(\.test|\.spec)\.[jt]sx?$|(^|\/)tests?\/|(^|\/)test_.*\.py$|_test\.(py|go)$/.test(p);
const isSource = (p: string) => /\.(ts|tsx|js|jsx|mjs|py|go|rs|java)$/.test(p) && !isTest(p) && !/\.d\.ts$|(^|\/)(scripts|bench)\//.test(p);

const LINE_RULES: { re: RegExp; kind: ReviewFinding["kind"]; severity: ReviewFinding["severity"]; message: string; only?: RegExp }[] = [
  { re: /catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}/, kind: "bug-risk", severity: "medium", message: "Empty catch swallows errors" },
  { re: /\bconsole\.log\(/, kind: "hygiene", severity: "low", message: "console.log left in source", only: /\.(ts|tsx|js|jsx)$/ },
  { re: /\b(TODO|FIXME|XXX)\b/, kind: "hygiene", severity: "low", message: "TODO/FIXME added" },
  { re: /:\s*any\b|as any\b/, kind: "bug-risk", severity: "low", message: "`any` weakens type checking", only: /\.tsx?$/ },
  { re: /@ts-ignore|eslint-disable/, kind: "bug-risk", severity: "medium", message: "Checker suppressed (@ts-ignore / eslint-disable)" },
  { re: /[^=!]==\s*(?!null\b|undefined\b)[^=\s]/, kind: "bug-risk", severity: "low", message: "Loose equality (==)", only: /\.(ts|tsx|js|jsx)$/ },
  { re: /\.(only|skip)\(/, kind: "bug-risk", severity: "high", message: "Focused/skipped test (.only/.skip) will hide failures", only: /(\.test|\.spec)\./ },
  { re: /^\s*(?!.*\bawait\b).*\b(fetch|writeFile|readFile)\([^)]*\)\s*;?\s*$/, kind: "bug-risk", severity: "low", message: "Possibly un-awaited async call", only: /\.(ts|tsx|js|mjs)$/ },
  { re: /\bDROP\s+(TABLE|COLUMN)\b|\bTRUNCATE\b/i, kind: "risk", severity: "high", message: "Destructive SQL (DROP/TRUNCATE) — run the migration auditor", only: /\.sql$|(^|\/)migrations?\//i },
];

/** Deterministic PR review: bugs/risks, missing tests, and the Security agent's OWASP rules on added lines only. */
export function reviewDiff(diff: string): DiffReview {
  const files = parseUnifiedDiff(diff);
  const findings: ReviewFinding[] = [];
  for (const f of files) {
    for (const a of f.added) {
      for (const r of LINE_RULES) {
        if (r.only && !r.only.test(f.path)) continue;
        if (r.re.test(a.text)) findings.push({ kind: r.kind, severity: r.severity, file: f.path, line: a.line, message: r.message, source: "diff-rules" });
      }
    }
    if (f.status === "deleted" && isTest(f.path)) findings.push({ kind: "missing-tests", severity: "high", file: f.path, line: null, message: "Test file deleted", source: "diff-rules" });
    if (f.added.length > 400) findings.push({ kind: "risk", severity: "low", file: f.path, line: null, message: `Large change (${f.added.length} added lines) — consider splitting`, source: "diff-rules" });
  }
  const touchedSource = files.filter((f) => isSource(f.path) && f.status !== "deleted" && f.added.length);
  const touchedTests = files.filter((f) => isTest(f.path) && f.status !== "deleted");
  if (touchedSource.length && !touchedTests.length) {
    findings.push({ kind: "missing-tests", severity: "medium", file: touchedSource.map((f) => f.path).join(", "), line: null, message: "Source changed but no test file was added or updated", source: "diff-rules" });
  }
  const paths = files.map((f) => f.path);
  if (paths.some((p) => /(^|\/)package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$/.test(p)) && !paths.some((p) => /(^|\/)package\.json$/.test(p))) {
    findings.push({ kind: "risk", severity: "low", file: "lockfile", line: null, message: "Lockfile changed without package.json", source: "diff-rules" });
  }
  // Reuse the MERIDIAN Security agent, keeping new-file line numbers: blank out unchanged lines.
  const sparse: Record<string, string> = {};
  for (const f of files) {
    if (!f.added.length) continue;
    const max = f.added[f.added.length - 1].line;
    const lines = new Array<string>(max).fill("");
    for (const a of f.added) lines[a.line - 1] = a.text;
    sparse[f.path] = lines.join("\n");
  }
  const security = scanSecurity(sparse).findings;
  for (const s of security) findings.push({ kind: "security", severity: s.severity === "critical" || s.severity === "high" ? "high" : s.severity === "medium" ? "medium" : "low", file: s.file, line: s.line, message: `${s.owasp}: ${s.message}`, source: "security-agent" });
  const additions = files.reduce((n, f) => n + f.added.length, 0);
  const deletions = files.reduce((n, f) => n + f.removed.length, 0);
  return { files, stats: { files: files.length, additions, deletions }, findings, security };
}

export function reviewMarkdown(r: DiffReview, llm?: { triage?: string; analysis?: string; models?: string[] }): string {
  const sev = { high: "🔴", medium: "🟠", low: "⚪" } as const;
  const order = { high: 0, medium: 1, low: 2 } as const;
  const f = [...r.findings].sort((a, b) => order[a.severity] - order[b.severity]);
  return [
    `### CI Whisperer — PR review`,
    `${r.stats.files} files, +${r.stats.additions} / −${r.stats.deletions}. ${f.length} deterministic findings (${f.filter((x) => x.severity === "high").length} high).`,
    "",
    ...(f.length ? f.slice(0, 40).map((x) => `- ${sev[x.severity]} **${x.kind}** \`${x.file}${x.line ? `:${x.line}` : ""}\` — ${x.message}`) : ["- No rule-based findings."]),
    llm?.triage ? `\n#### Nemotron Nano triage\n${llm.triage}` : "",
    llm?.analysis ? `\n#### Nemotron Super analysis\n${llm.analysis}` : "",
    !llm?.triage && !llm?.analysis ? "\n_Nemotron review skipped (no NEBIUS_API_KEY); rule-based findings only._" : "",
    llm?.models?.length ? `\n<sub>Models: ${llm.models.join(", ")}</sub>` : "",
  ].filter((x) => x !== "").join("\n");
}
