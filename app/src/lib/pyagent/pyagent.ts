import { createServerFn } from "@tanstack/react-start";
import type { PyRunIn } from "./client";

function opts() {
  const baseUrl = process.env.PY_AGENT_URL;
  if (!baseUrl) throw new Error("PY_AGENT_URL is not set; start agents-py (see agents-py/README.md).");
  return { baseUrl, token: process.env.PY_SERVICE_TOKEN };
}

export const pyAgentReview = createServerFn({ method: "POST" })
  .validator((input: PyRunIn) => input)
  .handler(async ({ data }) => (await import("./client")).pyReview(opts(), data));

export const pyAgentPlan = createServerFn({ method: "POST" })
  .validator((input: PyRunIn) => input)
  .handler(async ({ data }) => (await import("./client")).pyPlan(opts(), data));
