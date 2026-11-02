import { test } from "node:test";
import assert from "node:assert/strict";
import { pyReview, PyAgentError } from "../src/lib/pyagent/client";

test("pyagent client: posts JSON with bearer token and parses typed output", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fetchFn = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return new Response(JSON.stringify({ report: { summary: "ok", verdict: "approve", findings: [] }, meta: { provider: "nebius", model: "m", input_tokens: 1, output_tokens: 1, cost_usd: null, ms: 1 } }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await pyReview({ baseUrl: "http://x/", token: "t", fetchFn }, { prompt: "p" });
  assert.equal(r.report.verdict, "approve");
  assert.equal(seen!.url, "http://x/review");
  assert.equal((seen!.init.headers as Record<string, string>).authorization, "Bearer t");
});

test("pyagent client: surfaces FastAPI error detail", async () => {
  const fetchFn = (async () => new Response(JSON.stringify({ detail: "NEBIUS_API_KEY is not set" }), { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(pyReview({ baseUrl: "http://x", fetchFn }, { prompt: "p" }), (e: unknown) => e instanceof PyAgentError && e.status === 400 && /NEBIUS_API_KEY/.test(e.message));
});
