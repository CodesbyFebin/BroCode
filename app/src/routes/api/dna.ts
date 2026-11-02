import { createFileRoute } from "@tanstack/react-router";

/**
 * PCM DNA retrieval endpoint for other models/tools:
 *   GET /api/dna?project=workspace&format=json|prompt
 * Requires `Authorization: Bearer $PCM_DNA_TOKEN` when PCM_DNA_TOKEN is set;
 * without a token it is only served outside production.
 */
export const Route = createFileRoute("/api/dna")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = process.env.PCM_DNA_TOKEN;
        if (token) {
          if (request.headers.get("authorization") !== `Bearer ${token}`) return new Response("Unauthorized", { status: 401 });
        } else if (process.env.NODE_ENV === "production") {
          return new Response("Set PCM_DNA_TOKEN to enable the DNA endpoint in production.", { status: 403 });
        }
        const url = new URL(request.url);
        const { loadDNA, DEFAULT_PROJECT } = await import("@/lib/pcm/dna.server");
        const { dnaPrompt } = await import("@/lib/pcm/dna");
        const dna = await loadDNA(url.searchParams.get("project") || DEFAULT_PROJECT);
        if (!dna) return Response.json({ error: "No DNA extracted yet for this project." }, { status: 404 });
        if (url.searchParams.get("format") === "prompt") return new Response(dnaPrompt(dna), { headers: { "content-type": "text/plain; charset=utf-8" } });
        return Response.json({ dna, prompt: dnaPrompt(dna) }, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
