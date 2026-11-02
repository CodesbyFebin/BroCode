import { createFileRoute } from "@tanstack/react-router";

/** Webhook trigger: POST /api/hooks/<automation-id> with header X-BroCODE-Signature: sha256=<hmac of raw body>. */
export const Route = createFileRoute("/api/hooks/$id")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { getScheduler } = await import("@/lib/v2/automations.server");
        const body = await request.text();
        const r = await getScheduler().webhook(params.id, body, request.headers.get("x-brocode-signature"), process.env);
        return r.status === 200 ? Response.json(r.run) : new Response(null, { status: r.status });
      },
    },
  },
});
