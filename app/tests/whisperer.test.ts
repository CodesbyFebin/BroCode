import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractDNA, dnaPrompt } from "../src/lib/pcm/dna";
import { parseUnifiedDiff, reviewDiff } from "../src/lib/whisperer/diff";
import { analyzeCiLog } from "../src/lib/whisperer/cilog";
import { releaseNotes, parseCommit } from "../src/lib/whisperer/releasenotes";
import { auditConfig } from "../src/lib/whisperer/configaudit";
import { unifiedDiff } from "../src/lib/whisperer/patch";

const project = {
  "package.json": JSON.stringify({ type: "module", dependencies: { react: "19", zod: "3" }, devDependencies: { typescript: "5", eslint: "9", vitest: "1" }, scripts: { test: "vitest", typecheck: "tsc" } }),
  "tsconfig.json": "{}",
  "src/app.ts": "import { z } from 'zod';\nexport const a = 1;\n",
  "src/app.test.ts": "test('x', () => {});\n",
  "AGENTS.md": "# Rules\n- Never commit secrets\n- Always add tests\n",
  ".gitleaks.toml": "",
  ".github/workflows/ci.yml": "on: push\n",
};

test("extractDNA detects stack, conventions, rules; fingerprint stable", () => {
  const d = extractDNA(project, new Date(0));
  assert.ok(d.stack.languages.includes("TypeScript"));
  assert.ok(d.stack.frameworks.includes("React"));
  assert.equal(d.quality.secretScan, true);
  assert.ok(d.rules.some((r) => /secrets/.test(r.text)));
  assert.equal(extractDNA(project, new Date(1)).fingerprint, d.fingerprint);
  assert.notEqual(extractDNA({ ...project, "x.ts": "1" }).fingerprint, d.fingerprint);
  const p = dnaPrompt(d, 400);
  assert.ok(p.length <= 400 && /TypeScript/.test(p));
});

const DIFF = `diff --git a/src/pay.ts b/src/pay.ts
--- a/src/pay.ts
+++ b/src/pay.ts
@@ -1,2 +1,5 @@
 export function pay() {
+  try { run(); } catch (e) {}
+  const q = "SELECT * FROM t WHERE id=" + req.query.id;
+  eval(input);
 }
diff --git a/src/old.test.ts b/src/old.test.ts
deleted file mode 100644
--- a/src/old.test.ts
+++ /dev/null
@@ -1 +0,0 @@
-test("a", () => {});
`;

test("parseUnifiedDiff keeps new-file line numbers", () => {
  const f = parseUnifiedDiff(DIFF);
  assert.equal(f.length, 2);
  assert.deepEqual(f[0].added.map((a) => a.line), [2, 3, 4]);
  assert.equal(f[1].status, "deleted");
});

test("reviewDiff flags empty catch, security on added lines, deleted + missing tests", () => {
  const r = reviewDiff(DIFF);
  assert.ok(r.findings.some((x) => /catch/i.test(x.message) && x.line === 2));
  assert.ok(r.security.some((s) => s.line === 4));
  assert.ok(r.findings.some((x) => x.kind === "missing-tests"));
  assert.ok(r.findings.some((x) => /delet/i.test(x.message)));
  assert.equal(reviewDiff(DIFF.replace("== ", "")).stats.additions, 3);
});

test("analyzeCiLog categorises tsc, node:test, npm, missing module", () => {
  const tsc = analyzeCiLog("2026-01-01T00:00:00.0000000Z ##[group]Run npm run typecheck\nsrc/a.ts(12,5): error TS2322: Type 'string' is not assignable to type 'number'.\n##[error]Process completed with exit code 2.");
  assert.equal(tsc.failures[0].category, "typescript");
  assert.equal(tsc.failures[0].file, "src/a.ts");
  assert.equal(tsc.failures[0].line, 12);
  assert.equal(tsc.exitCode, 2);
  assert.equal(analyzeCiLog("not ok 3 - adds numbers\n  ---\n  error: 'Expected values to be strictly equal'").failures[0].category, "test");
  assert.equal(analyzeCiLog("npm ERR! code ERESOLVE\nnpm ERR! ERESOLVE unable to resolve dependency tree").failures[0].category, "dependency");
  assert.equal(analyzeCiLog("Error: Cannot find module 'left-pad'").failures[0].category, "module-not-found");
});

test("releaseNotes groups conventional commits and surfaces breaking changes", () => {
  assert.equal(parseCommit({ sha: "a", message: "Merge pull request #7 from x/y" }).pr, 7);
  const md = releaseNotes([
    { sha: "aaaaaaa1", message: "feat(ui): add panel (#12)" },
    { sha: "bbbbbbb2", message: "fix: null crash" },
    { sha: "ccccccc3", message: "feat!: drop node 16" },
    { sha: "ddddddd4", message: "random tweak" },
  ], { repoUrl: "https://github.com/o/r" });
  assert.match(md, /Breaking/i);
  assert.match(md, /Features[\s\S]*add panel/);
  assert.match(md, /Fixes|Bug/i);
  assert.match(md, /o\/r\/pull\/12/);
  assert.match(md, /Other changes[\s\S]*random tweak/);
});

test("auditConfig catches workflow, docker and .env.example risks; placeholders pass", () => {
  const r = auditConfig({
    ".github/workflows/x.yml": "on: pull_request_target\njobs:\n  a:\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: echo \"${{ github.event.pull_request.title }}\"\n",
    "Dockerfile": "FROM node:latest\nRUN npm i\n",
    ".env.example": "API_KEY=sk_live_abcdefghijklmnop1234\nJWT_SECRET=replace-with-a-long-random-string\n",
  });
  const rules = new Set(r.findings.map((f) => f.rule));
  for (const k of ["gha-no-permissions", "gha-script-injection", "env-example-real-secret"]) assert.ok(rules.has(k), k);
  assert.ok([...rules].some((k) => k.startsWith("docker")));
  assert.equal(r.findings.filter((f) => f.rule === "env-example-real-secret").length, 1);
  assert.equal(r.blocking, true);
});

test("unifiedDiff produces a minimal hunk", () => {
  const d = unifiedDiff("a.ts", "1\n2\n3\n", "1\nX\n3\n");
  assert.match(d, /^--- a\/a\.ts/m);
  assert.match(d, /^-2$/m);
  assert.match(d, /^\+X$/m);
  assert.equal(unifiedDiff("a.ts", "same", "same"), "");
});

test("enterGrounding persists DNA and exposes it to nebius calls", async () => {
  process.env.PCM_DNA_DIR = mkdtempSync(join(tmpdir(), "dna-"));
  const { enterGrounding, currentGrounding, loadDNA, DEFAULT_PROJECT } = await import("../src/lib/pcm/dna.server");
  const dna = await enterGrounding(project);
  assert.ok(dna);
  assert.match(currentGrounding() ?? "", /TypeScript/);
  assert.equal((await loadDNA(DEFAULT_PROJECT))?.fingerprint, dna!.fingerprint);
});
