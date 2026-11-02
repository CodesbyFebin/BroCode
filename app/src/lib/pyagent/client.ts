// Typed client for the agents-py service (pydantic-ai). Pure: fetch is injectable for tests.
export type PyProvider = "nebius" | "meta" | "local-llama" | "test";
export type PyFinding = { severity: "critical" | "high" | "medium" | "low" | "info"; file: string; line: number; message: string };
export type PyReview = { summary: string; verdict: "approve" | "request_changes" | "comment"; findings: PyFinding[] };
export type PyPlan = { goal: string; steps: { title: string; files: string[]; check: string }[] };
export type PyMeta = { provider: string; model: string; input_tokens: number; output_tokens: number; cost_usd: number | null; ms: number };
export type PyRunIn = { prompt: string; files?: Record<string, string>; skills?: string; provider?: PyProvider; tier?: "nano" | "super" | "ultra" };

export type PyClientOpts = { baseUrl: string; token?: string; fetchFn?: typeof fetch; timeoutMs?: number };

export class PyAgentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function call<T>(o: PyClientOpts, path: string, body: unknown): Promise<T> {
  const f = o.fetchFn ?? fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs ?? 120_000);
  try {
    const res = await f(`${o.baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(o.token ? { authorization: `Bearer ${o.token}` } : {}) },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 500);
      try { detail = (JSON.parse(text) as { detail?: string }).detail ?? detail; } catch { /* keep text */ }
      throw new PyAgentError(`agents-py ${path} failed (${res.status}): ${detail}`, res.status);
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const pyReview = (o: PyClientOpts, input: PyRunIn) => call<{ report: PyReview; meta: PyMeta }>(o, "/review", input);
export const pyPlan = (o: PyClientOpts, input: PyRunIn) => call<{ plan: PyPlan; meta: PyMeta }>(o, "/plan", input);
export const pyEvalReview = (o: PyClientOpts, provider?: PyProvider) =>
  call<{ provider: string; model: string; passed: number; total: number; cases: { name: string; scores: Record<string, boolean> }[] }>(o, "/evals/review", { provider });
