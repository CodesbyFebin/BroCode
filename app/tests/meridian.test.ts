import { test } from "node:test";
import assert from "node:assert/strict";
import { scanSecurity } from "../src/lib/meridian/security";
import { checkCompliance } from "../src/lib/meridian/compliance";
import { generateWorkflow } from "../src/lib/meridian/cicd";
import { activeParamsB, estimateGreen, DEFAULT_ASSUMPTIONS, assumptionsFromEnv } from "../src/lib/meridian/greenops";
import { normalizePlan, normalizeDesign, parseJsonObject } from "../src/lib/meridian/contracts";

const VULN = {
  "src/app.js": [
    'const key = "sk-abcdefghijklmnopqrstuvwxyz123456";',
    "eval(req.body.code);",
    'db.query("SELECT * FROM users WHERE id = " + req.params.id);',
    "require('child_process').exec('ls ' + req.query.dir);",
    "crypto.createHash('md5');",
  ].join("\n"),
};

test("security: flags secrets, eval, SQLi, command injection, weak hash", () => {
  const r = scanSecurity(VULN);
  const msgs = r.findings.map((f) => `${f.owasp} ${f.message}`).join("\n");
  assert.ok(r.findings.length >= 4, msgs);
  assert.equal(r.blocking, true);
  assert.ok(r.findings.every((f) => f.file === "src/app.js" && f.line >= 1));
});

test("security: clean code has no findings", () => {
  const r = scanSecurity({ "src/ok.ts": "export const add = (a: number, b: number) => a + b;\n" });
  assert.equal(r.findings.length, 0);
  assert.equal(r.blocking, false);
});

test("compliance: security findings fail controls; outputs all three frameworks", () => {
  const sec = scanSecurity(VULN);
  const c = checkCompliance(VULN, sec, "CREATE TABLE patients (id serial, email text, diagnosis text);");
  const fws = new Set(c.controls.map((x) => x.framework));
  for (const f of ["GDPR", "HIPAA", "SOC2"]) assert.ok(fws.has(f as never));
  assert.equal(c.failing, c.controls.filter((x) => x.status === "fail").length);
  assert.ok(c.failing > 0);
});

test("pipeline: node project gets npm ci + test job and gitleaks", () => {
  const p = generateWorkflow({ "package.json": JSON.stringify({ scripts: { test: "node --test", build: "tsc" } }), "package-lock.json": "{}" });
  assert.match(p.path, /^\.github\/workflows\/.+\.ya?ml$/);
  assert.match(p.yaml, /npm ci/);
  assert.match(p.yaml, /npm (run )?test/);
  assert.ok(p.jobs.length >= 2);
});

test("pipeline: python project gets pytest", () => {
  const p = generateWorkflow({ "requirements.txt": "pytest\n", "test_x.py": "def test_a(): assert 1\n" });
  assert.match(p.yaml, /pytest/);
});

test("greenops: active params from model id and FLOPs = 2*P*tokens", () => {
  assert.equal(activeParamsB("nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"), 3);
  assert.equal(activeParamsB("nvidia/nemotron-3-super-120b-a12b"), 12);
  const g = estimateGreen([{ model: "nvidia/nemotron-3-super-120b-a12b", tokens: 1000 }], 0, DEFAULT_ASSUMPTIONS);
  assert.equal(g.llm[0].flops, 2 * 12e9 * 1000);
  const kWh = (2 * 12e9 * 1000) / DEFAULT_ASSUMPTIONS.flopsPerJoule * DEFAULT_ASSUMPTIONS.pue / 3.6e6;
  assert.ok(Math.abs(g.totals.kWh - kWh) < 1e-12);
  assert.ok(g.assumptions.length > 0);
});

test("greenops: env overrides assumptions", () => {
  const a = assumptionsFromEnv({ GREENOPS_GRID_G_PER_KWH: "100" });
  assert.equal(a.gridGCO2PerKWh, 100);
});

test("contracts: plan/design normalize from fenced JSON and reject garbage", () => {
  const plan = normalizePlan(parseJsonObject('```json\n{"summary":"s","tasks":[{"id":"T1","title":"x","acceptance":["a"],"estimate":"M"}]}\n```'));
  assert.equal(plan.tasks[0].estimate, "M");
  const d = normalizeDesign({ adr: "# ADR", files: [{ path: "a.ts", purpose: "p" }], interfaces: ["f(): void"] });
  assert.equal(d.files.length, 1);
  assert.throws(() => parseJsonObject("no json here"));
});
