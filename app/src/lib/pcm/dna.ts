/**
 * PCM "project DNA": a passive, deterministic read of the workspace — tech stack,
 * patterns, conventions and quality standards — compact enough to ground every
 * Nemotron call. Nothing here calls a model; every field is derived from files.
 */
export type ProjectDNA = {
  version: 1;
  fingerprint: string;
  fileCount: number;
  stack: { languages: string[]; frameworks: string[]; packageManager: string | null; testRunner: string | null; runtime: string | null };
  patterns: string[];
  conventions: { indent: string | null; quotes: "single" | "double" | null; semicolons: boolean | null; fileNaming: string | null; moduleSystem: string | null };
  quality: { typecheck: boolean; lint: string | null; formatter: string | null; tests: number; ci: string[]; secretScan: boolean };
  rules: { source: string; text: string }[];
  extractedAt: string;
};

const LANG: Record<string, string> = { ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", py: "Python", go: "Go", rs: "Rust", java: "Java", rb: "Ruby", sql: "SQL", css: "CSS" };

const FRAMEWORKS: [string, string][] = [
  ["@tanstack/react-start", "TanStack Start"], ["next", "Next.js"], ["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"],
  ["express", "Express"], ["fastify", "Fastify"], ["hono", "Hono"], ["zustand", "Zustand"], ["tailwindcss", "Tailwind CSS"],
  ["@electric-sql/pglite", "PGlite"], ["prisma", "Prisma"], ["drizzle-orm", "Drizzle"], ["vite", "Vite"], ["zod", "Zod"],
  ["fastapi", "FastAPI"], ["django", "Django"], ["flask", "Flask"], ["pytest", "pytest"],
];

export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

function majority<T>(votes: T[]): T | null {
  if (!votes.length) return null;
  const m = new Map<T, number>();
  for (const v of votes) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Rule headings/bullets from convention docs (AGENTS.md, CLAUDE.md, CONTRIBUTING.md …). */
export function extractRules(path: string, content: string, max = 12): { source: string; text: string }[] {
  const out: { source: string; text: string }[] = [];
  for (const line of content.split("\n")) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line.trim()) ?? /^(?:[-*]|\d+\.)\s+\*\*(.+?)\*\*/.exec(line.trim()) ?? /^(?:[-*]|\d+\.)\s+((?:always|never|must|do not|don't|prefer|avoid|use)\b.+)$/i.exec(line.trim());
    if (!m) continue;
    const text = (m[2] ?? m[1]).replace(/[`*]/g, "").trim();
    if (text.length < 3 || text.length > 120) continue;
    out.push({ source: path, text });
    if (out.length >= max) break;
  }
  return out;
}

export function extractDNA(files: Record<string, string>, now = new Date()): ProjectDNA {
  const paths = Object.keys(files).sort();
  const deps: Record<string, string> = {};
  let scripts: Record<string, string> = {};
  let moduleSystem: string | null = null;
  for (const p of paths.filter((x) => /(^|\/)package\.json$/.test(x))) {
    try {
      const j = JSON.parse(files[p]);
      Object.assign(deps, j.dependencies, j.devDependencies);
      if (!/(^|\/)node_modules\//.test(p) && (p === "package.json" || !Object.keys(scripts).length)) scripts = { ...scripts, ...(j.scripts ?? {}) };
      if (j.type === "module") moduleSystem = "ESM";
      else if (!moduleSystem) moduleSystem = "CommonJS";
    } catch { /* not JSON */ }
  }
  const pyReq = paths.filter((p) => /requirements.*\.txt$|pyproject\.toml$/.test(p)).map((p) => files[p].toLowerCase()).join("\n");

  const langCount = new Map<string, number>();
  for (const p of paths) {
    const l = LANG[p.split(".").pop()!.toLowerCase()];
    if (l) langCount.set(l, (langCount.get(l) ?? 0) + 1);
  }
  const languages = [...langCount.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  const frameworks = FRAMEWORKS.filter(([d]) => d in deps || new RegExp(`^${d}\\b`, "m").test(pyReq)).map(([, n]) => n);

  const has = (re: RegExp) => paths.some((p) => re.test(p));
  const packageManager = has(/pnpm-lock\.yaml$/) ? "pnpm" : has(/yarn\.lock$/) ? "yarn" : has(/bun\.lockb?$/) ? "bun" : has(/package-lock\.json$/) ? "npm" : has(/poetry\.lock$/) ? "poetry" : pyReq ? "pip" : null;
  const testScript = Object.entries(scripts).filter(([k]) => /^test/.test(k)).map(([, v]) => v).join(" ");
  const testRunner = /vitest/.test(testScript) || "vitest" in deps ? "vitest" : /jest/.test(testScript) || "jest" in deps ? "jest" : /node .*--test/.test(testScript) ? "node:test" : /pytest/.test(pyReq) || has(/(^|\/)test_.*\.py$/) ? "pytest" : null;
  const runtime = languages[0] === "Python" ? "Python" : Object.keys(deps).length ? "Node.js" : null;

  const code = paths.filter((p) => /\.(ts|tsx|js|jsx|mjs|py)$/.test(p) && !/node_modules|dist\//.test(p));
  const indent: string[] = [], quotes: ("single" | "double")[] = [], semis: boolean[] = [];
  for (const p of code.slice(0, 60)) {
    const lines = files[p].split("\n").slice(0, 200);
    for (const l of lines) {
      const m = /^( +|\t+)\S/.exec(l);
      if (m) indent.push(m[1][0] === "\t" ? "tabs" : m[1].length % 4 === 0 && m[1].length >= 4 && !lines.some((x) => /^ {2}\S/.test(x)) ? "4 spaces" : "2 spaces");
      if (/\.py$/.test(p)) continue;
      const q = /(?:import|from|require\()\s*(['"])/.exec(l);
      if (q) quotes.push(q[1] === "'" ? "single" : "double");
      if (/^\s*(const|let|import|return|export)\b.*[^{(,[]$/.test(l)) semis.push(/;\s*$/.test(l));
    }
  }
  const base = code.map((p) => p.split("/").pop()!.replace(/\.[^.]+$/, "")).filter((n) => !/^index$/.test(n));
  const fileNaming = majority(base.map((n) => (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(n) ? "kebab-case" : /^[a-z]+[A-Z]/.test(n) ? "camelCase" : /^[A-Z][a-z]+[A-Z]?/.test(n) ? "PascalCase" : /_/.test(n) ? "snake_case" : "lowercase")));

  const patterns: string[] = [];
  const all = code.map((p) => files[p]).join("\n");
  const pat = (re: RegExp, label: string) => re.test(all) && patterns.push(label);
  pat(/createServerFn\(/, "TanStack server functions (createServerFn().validator().handler())");
  pat(/\bcreate<.*>\(\)\(|from "zustand"/, "Zustand stores for client state");
  pat(/await import\(/, "dynamic imports to keep server code out of the client bundle");
  pat(/\.server\.(ts|js)/.test(paths.join(" ")) ? /./ : /$^/, "*.server.ts files for server-only modules");
  pat(/\bz\.object\(/, "Zod schemas for validation");
  pat(/from ["']node:test["']/, "node:test unit tests");
  pat(/export function use[A-Z]/, "custom React hooks");
  pat(/@\/(components|lib)\//, "@/ path alias imports");
  pat(/^\s*def test_/m, "pytest-style test functions");
  if (has(/^src\/routes\//)) patterns.push("file-based routing under src/routes");

  const ci = paths.filter((p) => /^\.github\/workflows\/.+\.ya?ml$/.test(p));
  const rules = paths
    .filter((p) => /(^|\/)(AGENTS|CLAUDE|CONTRIBUTING|CONVENTIONS)\.md$/i.test(p))
    .flatMap((p) => extractRules(p, files[p]))
    .slice(0, 20);

  const dna: Omit<ProjectDNA, "fingerprint" | "extractedAt"> = {
    version: 1,
    fileCount: paths.length,
    stack: { languages, frameworks, packageManager, testRunner, runtime },
    patterns,
    conventions: { indent: majority(indent), quotes: majority(quotes), semicolons: semis.length ? semis.filter(Boolean).length >= semis.length / 2 : null, fileNaming, moduleSystem },
    quality: {
      typecheck: has(/tsconfig\.json$/) || /tsc/.test(Object.values(scripts).join(" ")),
      lint: has(/eslint\.config|\.eslintrc/) ? "ESLint" : has(/ruff\.toml|\.flake8/) || /ruff|flake8/.test(pyReq) ? "Ruff/Flake8" : null,
      formatter: has(/\.prettierrc|prettier\.config/) ? "Prettier" : /black/.test(pyReq) ? "Black" : null,
      tests: paths.filter((p) => /(\.test|\.spec)\.[jt]sx?$|(^|\/)test_.*\.py$|_test\.py$/.test(p)).length,
      ci,
      secretScan: has(/\.gitleaks\.toml$/) || ci.some((p) => /gitleaks/.test(files[p])),
    },
    rules,
  };
  return { ...dna, fingerprint: hashText(JSON.stringify(dna)), extractedAt: now.toISOString() };
}

/** Compact grounding block injected as system context into Nemotron calls. */
export function dnaPrompt(d: ProjectDNA, max = 1800): string {
  const lines = [
    `PROJECT DNA (auto-extracted from ${d.fileCount} files, fingerprint ${d.fingerprint}). Follow these; do not contradict them.`,
    `Stack: ${[...d.stack.languages, ...d.stack.frameworks].join(", ") || "unknown"}${d.stack.packageManager ? `; package manager ${d.stack.packageManager}` : ""}${d.stack.testRunner ? `; tests with ${d.stack.testRunner}` : ""}.`,
    d.patterns.length ? `Patterns: ${d.patterns.join("; ")}.` : "",
    `Conventions: ${[d.conventions.indent && `indent ${d.conventions.indent}`, d.conventions.quotes && `${d.conventions.quotes} quotes`, d.conventions.semicolons != null && (d.conventions.semicolons ? "semicolons" : "no semicolons"), d.conventions.fileNaming && `${d.conventions.fileNaming} file names`, d.conventions.moduleSystem].filter(Boolean).join(", ") || "unknown"}.`,
    `Quality bar: ${[d.quality.typecheck && "must typecheck", d.quality.lint && `${d.quality.lint} clean`, d.quality.formatter, `${d.quality.tests} test files exist — add tests for new behaviour`, d.quality.ci.length && `CI: ${d.quality.ci.join(", ")}`, d.quality.secretScan && "secret scanning on"].filter(Boolean).join("; ")}.`,
    d.rules.length ? `Project rules: ${d.rules.map((r) => r.text).join(" | ")}` : "",
  ].filter(Boolean);
  const s = lines.join("\n");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
