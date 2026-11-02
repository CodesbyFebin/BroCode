export type CiFailure = {
  category: "typescript" | "lint" | "test" | "dependency" | "module-not-found" | "build" | "timeout" | "permission" | "oom" | "unknown";
  file: string | null;
  line: number | null;
  message: string;
  excerpt: string;
  hint: string;
};
export type CiAnalysis = { failures: CiFailure[]; failedStep: string | null; exitCode: number | null; cleanedLines: number };

/** Strip GitHub Actions log noise: "job\tstep\t" prefixes, ISO timestamps, ANSI escapes, ##[group] markers. */
export function cleanLog(log: string): string[] {
  return log
    .replace(/\r/g, "")
    .split("\n")
    // eslint-disable-next-line no-control-regex -- strip ANSI escapes from CI logs
    .map((l) => l.replace(/^[^\t\n]{1,80}\t[^\t\n]{1,120}\t/, "").replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, "").replace(/\x1b\[[0-9;]*m/g, "").replace(/^##\[(group|endgroup)\]/, ""));
}

const RULES: { re: RegExp; category: CiFailure["category"]; hint: (m: RegExpExecArray) => string; file?: (m: RegExpExecArray) => [string | null, number | null] }[] = [
  { re: /^(.+?\.tsx?)\((\d+),\d+\): error (TS\d+): (.+)$/, category: "typescript", hint: (m) => `Type error ${m[3]} — fix the types at the reported line (do not add @ts-ignore).`, file: (m) => [m[1], Number(m[2])] },
  { re: /^(.+?\.tsx?):(\d+):\d+ - error (TS\d+): (.+)$/, category: "typescript", hint: (m) => `Type error ${m[3]}.`, file: (m) => [m[1], Number(m[2])] },
  { re: /^\s*(\d+):(\d+)\s+error\s+(.+?)\s{2,}([\w/@-]+)$/, category: "lint", hint: (m) => `ESLint rule ${m[4]} — fix the code rather than disabling the rule.`, file: (m) => [null, Number(m[1])] },
  { re: /Cannot find module '([^']+)'|Module not found: .*?'([^']+)'|ERR_MODULE_NOT_FOUND.*?'([^']+)'/, category: "module-not-found", hint: (m) => `Import '${m[1] ?? m[2] ?? m[3]}' does not resolve: check the path/extension, or add the dependency to package.json and the lockfile.` },
  { re: /npm ERR! (code )?(ERESOLVE|E404|ETARGET|ENOTFOUND)|npm error code (ERESOLVE|E404|ETARGET)|`npm ci` can only install packages when your package.json and package-lock.json/, category: "dependency", hint: () => "Dependency resolution failed: regenerate the lockfile with the same npm version (`npm install`), commit it, and use `npm ci` in CI." },
  { re: /^not ok \d+ - (.+)$/, category: "test", hint: (m) => `node:test failure in "${m[1]}" — read the assertion diff below the line.` },
  { re: /^\s*● (.+?) › (.+)$/, category: "test", hint: (m) => `Jest/Vitest failure: ${m[1]} › ${m[2]}.` },
  { re: /^\s*(?:FAIL|×|✗)\s+(\S+\.(?:test|spec)\.[jt]sx?)/, category: "test", hint: () => "Test file failed.", file: (m) => [m[1], null] },
  { re: /^FAILED (\S+?)::(\S+)/, category: "test", hint: (m) => `pytest failure ${m[2]}.`, file: (m) => [m[1], null] },
  { re: /AssertionError|expected .+ (to (equal|be)|but got)/i, category: "test", hint: () => "Assertion mismatch between expected and actual values." },
  { re: /JavaScript heap out of memory|exit code 137|Killed$/, category: "oom", hint: () => "Out of memory: raise NODE_OPTIONS=--max-old-space-size or reduce parallelism." },
  { re: /The job running on runner .* has exceeded the maximum execution time|timed out after/i, category: "timeout", hint: () => "Timeout: look for hanging tests/open handles or raise timeout-minutes." },
  { re: /Resource not accessible by integration|403 Forbidden|Permission denied/i, category: "permission", hint: () => "Token lacks permission: add the minimal `permissions:` the job needs." },
  { re: /Build failed|error during build|\[vite\]: Rollup failed|ERROR in /i, category: "build", hint: () => "Build step failed; the first error above this line is the cause." },
];

export function analyzeCiLog(log: string, maxFailures = 12): CiAnalysis {
  const lines = cleanLog(log);
  const failures: CiFailure[] = [];
  const seen = new Set<string>();
  let failedStep: string | null = null;
  let exitCode: number | null = null;
  let lastStep: string | null = null;
  lines.forEach((l, i) => {
    const step = /^Run (.+)$/.exec(l.trim());
    if (step) lastStep = step[1].slice(0, 120);
    const ec = /##\[error\]Process completed with exit code (\d+)/.exec(l);
    if (ec) {
      exitCode = Number(ec[1]);
      failedStep = failedStep ?? lastStep;
    }
    for (const r of RULES) {
      const m = r.re.exec(l);
      if (!m) continue;
      const key = `${r.category}:${l.trim()}`;
      if (seen.has(key)) break;
      seen.add(key);
      const [file, line] = r.file ? r.file(m) : [null, null];
      failures.push({ category: r.category, file, line, message: l.trim().slice(0, 300), excerpt: lines.slice(Math.max(0, i - 3), i + 8).join("\n").slice(0, 1500), hint: r.hint(m) });
      break;
    }
  });
  if (!failures.length) {
    const i = lines.findIndex((l) => /##\[error\]|\berror\b/i.test(l));
    if (i >= 0) failures.push({ category: "unknown", file: null, line: null, message: lines[i].trim().slice(0, 300), excerpt: lines.slice(Math.max(0, i - 15), i + 3).join("\n").slice(0, 2000), hint: "No known pattern matched; see the excerpt." });
  }
  return { failures: failures.slice(0, maxFailures), failedStep, exitCode, cleanedLines: lines.length };
}

export function ciMarkdown(a: CiAnalysis, llm?: { explanation?: string; model?: string }): string {
  return [
    "### CI Whisperer — why CI failed",
    `Failed step: ${a.failedStep ? `\`${a.failedStep}\`` : "unknown"}${a.exitCode != null ? ` (exit ${a.exitCode})` : ""}. ${a.failures.length} failure signal(s).`,
    "",
    ...a.failures.map((f) => `- **${f.category}**${f.file ? ` \`${f.file}${f.line ? `:${f.line}` : ""}\`` : ""}: ${f.message}\n  - Suggested fix: ${f.hint}`),
    a.failures[0] ? `\n<details><summary>First failure excerpt</summary>\n\n\`\`\`\n${a.failures[0].excerpt}\n\`\`\`\n</details>` : "",
    llm?.explanation ? `\n#### Nemotron Super explanation\n${llm.explanation}\n<sub>${llm.model}</sub>` : "\n_Nemotron explanation skipped (no NEBIUS_API_KEY); pattern-based analysis only._",
  ].filter((x) => x !== "").join("\n");
}
