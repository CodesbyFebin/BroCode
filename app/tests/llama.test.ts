import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENTS, DEFAULT_SETTINGS, PROVIDERS, fallbackRoute, resolveRoute } from "../src/lib/agent/providers";
import { NEMOTRON, ROLE_TIER } from "../src/lib/agent/nebius";
import { META_MODELS, metaCostUsd, isLlamaProvider } from "../src/lib/agent/llama";
import { checkMetaCap, llamaGuardCheck, metaConfig, recordMetaSpend, resetMetaLedgerForTests } from "../src/lib/agent/llama.server";
import type { SettingsState } from "../src/lib/agent/types";

test("Nemotron on Nebius stays the default for every role and every strategy", () => {
  assert.equal(DEFAULT_SETTINGS.defaultProviderId, "nebius");
  for (const a of AGENTS) assert.deepEqual(resolveRoute(a.id, DEFAULT_SETTINGS), { providerId: "nebius", model: NEMOTRON[ROLE_TIER[a.id]] });
  assert.equal(fallbackRoute(DEFAULT_SETTINGS).providerId, "nebius");
  for (const strategy of ["quality", "fast", "free"] as SettingsState["strategy"][]) {
    const s = { ...DEFAULT_SETTINGS, strategy };
    for (const a of AGENTS) assert.ok(!isLlamaProvider(resolveRoute(a.id, s).providerId), `${strategy}/${a.id}`);
  }
});

test("Meta / local Llama are opt-in and only used when explicitly selected", () => {
  for (const id of ["meta", "local-llama"]) {
    const p = PROVIDERS.find((x) => x.id === id)!;
    assert.ok(p.optIn && p.attribution === "Built with Llama");
  }
  const s = { ...DEFAULT_SETTINGS, defaultProviderId: "meta", defaultModel: META_MODELS.wonder };
  assert.deepEqual(resolveRoute("planner", s), { providerId: "meta", model: META_MODELS.wonder });
  assert.equal(fallbackRoute({ ...s, defaultModel: "nope" }).model, META_MODELS.default);
  assert.equal(resolveRoute("tester", { ...DEFAULT_SETTINGS, defaultProviderId: "local-llama" }).providerId, "local-llama");
});

test("Meta config: env key server-side, overridable base URL, price math", () => {
  const c = metaConfig({ META_LLAMA_API_KEY: "k", META_BASE_URL: "https://x.test/v1/" });
  assert.equal(c.baseUrl, "https://x.test/v1");
  assert.equal(metaConfig({}).apiKey, undefined);
  assert.equal(metaConfig({}).capUsd, 1);
  assert.ok(Math.abs(metaCostUsd({ prompt_tokens: 1_000_000, completion_tokens: 1_000_000 }) - 0.3) < 1e-9);
});

test("Meta hard spend cap is enforced and spend is logged", async () => {
  const log = join(mkdtempSync(join(tmpdir(), "meta-")), "spend.jsonl");
  const env = { META_SPEND_CAP_USD: "0.001", META_SPEND_LOG: log };
  resetMetaLedgerForTests();
  assert.equal((await checkMetaCap(400, 1000, env)).ok, true); // ~$0.00021
  await recordMetaSpend(META_MODELS.default, { prompt_tokens: 2000, completion_tokens: 3500 }, env); // $0.0009
  const r = await checkMetaCap(400, 1000, env);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /cap/);
  const entry = JSON.parse(readFileSync(log, "utf8").trim());
  assert.equal(entry.promptTokens, 2000);
  assert.equal(entry.completionTokens, 3500);
  // ledger is replayed from the log after a restart
  resetMetaLedgerForTests();
  assert.equal((await checkMetaCap(400, 1000, env)).ok, false);
  assert.equal((await checkMetaCap(0, 0, { ...env, META_SPEND_CAP_USD: "0" })).ok, false);
});

test("Llama Guard hook is off by default and parses unsafe verdicts", async () => {
  assert.deepEqual(await llamaGuardCheck("hi", {}), { checked: false, safe: true, categories: [] });
  const fake = (async () => new Response(JSON.stringify({ choices: [{ message: { content: "unsafe\nS2" } }] }))) as typeof fetch;
  const r = await llamaGuardCheck("x", { LLAMA_GUARD: "on" }, fake);
  assert.equal(r.safe, false);
  assert.deepEqual(r.categories, ["S2"]);
});

test("META_LLAMA_API_KEY never reaches client code or the built client bundle", async () => {
  const { readdirSync, existsSync } = await import("node:fs");
  // Client-reachable modules must not read the key; only *.server.ts may.
  for (const f of ["src/lib/agent/llama.ts", "src/lib/agent/providers.ts", "src/components/workbench/gateway-panel.tsx", "src/components/workbench/status-bar.tsx"])
    assert.doesNotMatch(readFileSync(f, "utf8"), /process\.env\.META_LLAMA_API_KEY|env\.META_LLAMA_API_KEY/, f);
  // If a build exists, scan the static client assets for the actual key value (and a sentinel used in CI builds).
  const dir = ".vercel/output/static/assets";
  const secrets = [process.env.META_LLAMA_API_KEY, process.env.KEY_SENTINEL].filter((s): s is string => !!s && s.length >= 8);
  if (!existsSync(dir) || !secrets.length) return;
  for (const f of readdirSync(dir)) {
    const body = readFileSync(join(dir, f), "utf8");
    for (const s of secrets) assert.ok(!body.includes(s), `secret found in ${f}`);
  }
});
