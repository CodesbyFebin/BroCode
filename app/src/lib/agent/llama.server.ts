import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { META_BASE_URL, LOCAL_LLAMA_BASE_URL, metaCostUsd, metaEstimateUsd } from "./llama";

type Env = Record<string, string | undefined>;
const DEFAULT_CAP_USD = 1;

export function metaConfig(env: Env = process.env) {
  const cap = Number(env.META_SPEND_CAP_USD);
  return {
    apiKey: env.META_LLAMA_API_KEY || undefined,
    baseUrl: (env.META_BASE_URL || META_BASE_URL).replace(/\/+$/, ""),
    capUsd: Number.isFinite(cap) && cap >= 0 && env.META_SPEND_CAP_USD !== "" && env.META_SPEND_CAP_USD != null ? cap : DEFAULT_CAP_USD,
  };
}

export function localLlamaConfig(env: Env = process.env) {
  return { baseUrl: (env.LOCAL_LLAMA_BASE_URL || LOCAL_LLAMA_BASE_URL).replace(/\/+$/, ""), apiKey: env.LOCAL_LLAMA_API_KEY || "local" };
}

/** Spend ledger: in memory, plus an append-only JSONL log (META_SPEND_LOG) that is replayed on start. */
const ledger = { spentUsd: 0, loaded: false };
const logPath = (env: Env) => env.META_SPEND_LOG || path.join(process.cwd(), ".meta-spend.jsonl");

async function load(env: Env) {
  if (ledger.loaded) return;
  ledger.loaded = true;
  try {
    for (const l of (await readFile(logPath(env), "utf8")).split("\n")) if (l.trim()) ledger.spentUsd += Number(JSON.parse(l).costUsd) || 0;
  } catch { /* no log yet */ }
}

export function resetMetaLedgerForTests() { ledger.spentUsd = 0; ledger.loaded = false; }

export async function metaSpent(env: Env = process.env) { await load(env); return ledger.spentUsd; }

/** Hard cap: refuses when spent + worst-case estimate would exceed META_SPEND_CAP_USD. */
export async function checkMetaCap(promptChars: number, maxTokens: number, env: Env = process.env): Promise<{ ok: true } | { ok: false; error: string }> {
  await load(env);
  const { capUsd } = metaConfig(env);
  const est = metaEstimateUsd(promptChars, maxTokens);
  if (ledger.spentUsd + est > capUsd)
    return { ok: false, error: `Meta spend cap reached: spent $${ledger.spentUsd.toFixed(6)} + est. $${est.toFixed(6)} > cap $${capUsd} (META_SPEND_CAP_USD).` };
  return { ok: true };
}

export async function recordMetaSpend(model: string, usage: { prompt_tokens?: number; completion_tokens?: number } | undefined, env: Env = process.env) {
  await load(env);
  const costUsd = metaCostUsd(usage);
  ledger.spentUsd += costUsd;
  const entry = { at: new Date().toISOString(), provider: "meta", model, promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0, costUsd, totalUsd: ledger.spentUsd };
  console.info(`[meta] ${model} in=${entry.promptTokens} out=${entry.completionTokens} cost=$${costUsd.toFixed(6)} total=$${ledger.spentUsd.toFixed(6)}`);
  try {
    await mkdir(path.dirname(logPath(env)), { recursive: true });
    await appendFile(logPath(env), JSON.stringify(entry) + "\n");
  } catch { /* logging must not break the call */ }
  return costUsd;
}

/**
 * Optional Llama Guard 3 check (off by default). LLAMA_GUARD=on and LLAMA_GUARD_URL (OpenAI-compatible,
 * e.g. ./start.sh Llama-Guard-3-1B.Q4_K_M.gguf 8090). Returns unsafe + categories when the guard says so.
 * Fails open with a note if the guard is unreachable, so it never blocks Nemotron.
 */
export async function llamaGuardCheck(text: string, env: Env = process.env, fetchFn: typeof fetch = fetch): Promise<{ checked: boolean; safe: boolean; categories: string[]; note?: string }> {
  if (env.LLAMA_GUARD !== "on") return { checked: false, safe: true, categories: [] };
  const url = (env.LLAMA_GUARD_URL || "http://127.0.0.1:8090/v1").replace(/\/+$/, "");
  try {
    const res = await fetchFn(`${url}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: text.slice(0, 8000) }], max_tokens: 20, temperature: 0 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { checked: false, safe: true, categories: [], note: `guard ${res.status}` };
    const out = String(((await res.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "").trim();
    const unsafe = /^unsafe/i.test(out);
    return { checked: true, safe: !unsafe, categories: unsafe ? out.split(/\s+/).slice(1).join(",").split(",").filter(Boolean) : [] };
  } catch (e) {
    return { checked: false, safe: true, categories: [], note: `guard unreachable: ${(e as Error).message}` };
  }
}
