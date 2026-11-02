import { createServerFn } from "@tanstack/react-start";
import type { HandoffResult } from "./handoff";

/** Implement (Nemotron Super) → review (Nemotron Ultra, read-only) handoff. */
export const runHandoffFn = createServerFn({ method: "POST" })
  .validator((d: { goal: string; files: Record<string, string>; maxRounds?: number }) => d)
  .handler(async ({ data }): Promise<HandoffResult> => {
    const { runHandoff, implementAndReview, participant } = await import("./handoff");
    const { nebiusChat } = await import("../agent/llm.server");
    const { NEMOTRON } = await import("../agent/nebius");
    const ctxFiles = Object.entries(data.files ?? {}).slice(0, 30).map(([p, c]) => `--- ${p}\n${c.slice(0, 3000)}`).join("\n");
    return runHandoff(
      [participant("builder", "implementer", { modelId: NEMOTRON.super }), participant("reviewer", "reviewer", { modelId: NEMOTRON.ultra })],
      implementAndReview(data.goal.slice(0, 4000)),
      async ({ participant: p, task, upstream, readOnly }) => {
        const sys = readOnly
          ? "You are a strict read-only code reviewer. Do not write code; judge the proposed change."
          : "You are an implementer. Produce the change as unified diffs or full files.";
        const user = `${task.prompt}\n\nProject files:\n${ctxFiles}\n\n${Object.entries(upstream).map(([k, v]) => `## ${k} output\n${v}`).join("\n")}`;
        const r = await nebiusChat({ model: p.modelId!, maxTokens: 2000, temperature: 0.2, messages: [{ role: "system", content: sys }, { role: "user", content: user }] });
        return r.text;
      },
      { maxRounds: Math.min(Math.max(data.maxRounds ?? 2, 1), 4) },
    );
  });
