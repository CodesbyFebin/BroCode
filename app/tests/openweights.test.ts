import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENTS, DEFAULT_SETTINGS, PROVIDERS, fallbackRoute, resolveRoute } from "../src/lib/agent/providers";
import { NEMOTRON, ROLE_TIER } from "../src/lib/agent/nebius";
import { NEBIUS_OPEN_MODELS, OPEN_WEIGHT_PROVIDERS, isOpenWeightProvider, modelAttribution } from "../src/lib/agent/openweights";
import { openWeightConfig, openWeightModel } from "../src/lib/agent/openweights.server";
import type { SettingsState } from "../src/lib/agent/types";

test("Nemotron stays the default; open-weight providers never auto-route", () => {
  for (const a of AGENTS) assert.deepEqual(resolveRoute(a.id, DEFAULT_SETTINGS), { providerId: "nebius", model: NEMOTRON[ROLE_TIER[a.id]] });
  const keyed = { ...DEFAULT_SETTINGS, keys: Object.fromEntries(OPEN_WEIGHT_PROVIDERS.map((id) => [id, "k"])) };
  for (const strategy of ["auto", "quality", "fast", "free"] as SettingsState["strategy"][]) {
    const s = { ...keyed, strategy };
    for (const a of AGENTS) assert.ok(!isOpenWeightProvider(resolveRoute(a.id, s).providerId), `${strategy}/${a.id}`);
    assert.ok(!isOpenWeightProvider(fallbackRoute(s).providerId));
  }
});

test("every open-weight provider is registered, opt-in and carries license metadata", () => {
  for (const id of OPEN_WEIGHT_PROVIDERS) {
    const p = PROVIDERS.find((x) => x.id === id)!;
    assert.ok(p && p.optIn, id);
    for (const m of p.models) assert.ok(m.license, `${id}/${m.id}`);
  }
  assert.ok(NEBIUS_OPEN_MODELS.some((m) => m.verified) && NEBIUS_OPEN_MODELS.some((m) => m.verified === false));
  assert.ok(NEBIUS_OPEN_MODELS.filter((m) => m.verified === false).every((m) => /unverified/.test(m.label)));
});

test("explicit selection routes to the chosen open-weight model", () => {
  const s = { ...DEFAULT_SETTINGS, defaultProviderId: "nebius-open", defaultModel: "openai/gpt-oss-120b" };
  assert.deepEqual(resolveRoute("implementer", s), { providerId: "nebius-open", model: "openai/gpt-oss-120b" });
  assert.equal(resolveRoute("tester", { ...DEFAULT_SETTINGS, defaultProviderId: "ollama" }).providerId, "ollama");
});

test("Llama weights get Built with Llama attribution; others do not", () => {
  assert.equal(modelAttribution("hf", "meta-llama/Llama-3.3-70B-Instruct"), "Built with Llama");
  assert.equal(modelAttribution("nebius-open", "openai/gpt-oss-120b"), undefined);
});

test("server config reads env only, off when keys are unset", () => {
  assert.equal(openWeightConfig("openrouter-free", {}).apiKey, undefined);
  assert.equal(openWeightConfig("hf", {}).apiKey, undefined);
  assert.equal(openWeightConfig("hf", { HF_TOKEN: "t" }).apiKey, "t");
  assert.equal(openWeightConfig("nebius-open", { NEBIUS_API_KEY: "n" }).baseUrl, "https://api.tokenfactory.nebius.com/v1");
  const o = openWeightConfig("ollama", { OLLAMA_BASE_URL: "http://h:1/v1/", LOCAL_MODEL: "qwen3-coder" });
  assert.equal(o.baseUrl, "http://h:1/v1");
  assert.equal(openWeightModel("ollama", "local", o, "x"), "qwen3-coder");
  assert.equal(openWeightModel("ollama", undefined, openWeightConfig("ollama", {}), "x"), "llama3.2");
});

test("client-reachable modules never read open-weight keys", () => {
  for (const f of ["src/lib/agent/openweights.ts", "src/lib/agent/providers.ts", "src/components/workbench/gateway-panel.tsx"])
    assert.doesNotMatch(readFileSync(f, "utf8"), /process\.env/, f);
});
