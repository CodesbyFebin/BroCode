import { createServerFn } from "@tanstack/react-start";

export type Citation = { title: string; url: string; snippet: string };
export type ResearchResult = { ok: boolean; answer?: string; citations: Citation[]; error?: string; ms: number };

export async function tavilySearch(query: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<ResearchResult> {
  const started = Date.now();
  const res = await fetchImpl("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query: query.slice(0, 400),
      search_depth: "basic",
      max_results: 5,
      include_answer: true,
      topic: "general",
    }),
  });
  if (!res.ok) return { ok: false, citations: [], error: `tavily ${res.status}`, ms: Date.now() - started };
  const body = (await res.json()) as { answer?: string; results?: { title?: string; url?: string; content?: string }[] };
  return {
    ok: true,
    answer: body.answer,
    citations: (body.results ?? [])
      .filter((r) => r.url)
      .map((r) => ({ title: r.title ?? r.url!, url: r.url!, snippet: (r.content ?? "").slice(0, 300) })),
    ms: Date.now() - started,
  };
}

export function researchContext(r: ResearchResult): string {
  if (!r.ok || !r.citations.length) return "";
  const lines = r.citations.map((c, i) => `[${i + 1}] ${c.title} — ${c.url}\n${c.snippet}`);
  return `Web research (Tavily). Cite as [n] when you rely on it.\n${r.answer ? `Summary: ${r.answer}\n` : ""}${lines.join("\n")}`;
}

/** Researcher tool: live docs/API/error lookup via Tavily. No-op when TAVILY_API_KEY is unset. */
export const research = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<ResearchResult> => {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return { ok: false, citations: [], error: "TAVILY_API_KEY not set", ms: 0 };
    try {
      return await tavilySearch(data.query, key);
    } catch (err) {
      return { ok: false, citations: [], error: err instanceof Error ? err.message : "error", ms: 0 };
    }
  });
