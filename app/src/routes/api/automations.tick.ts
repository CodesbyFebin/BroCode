import { createFileRoute } from "@tanstack/react-router";

/** Cron tick: call once a minute from any external scheduler. Requires Authorization: Bearer $BROCODE_CRON_TOKEN. */
export const Route = createFileRoute("/api/automations/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.BROCODE_CRON_TOKEN;
        if (!token) return new Response("Set BROCODE_CRON_TOKEN to enable the tick endpoint.", { status: 503 });
        if (request.headers.get("authorization") !== `Bearer ${token}`) return new Response("Unauthorized", { status: 401 });
        const { getScheduler } = await import("@/lib/v2/automations.server");
        return Response.json({ runs: await getScheduler().tick() });
      },
    },
  },
});
