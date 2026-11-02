import { createServerFn } from "@tanstack/react-start";
import type { Workflow } from "./schema";
import type { WfResult } from "./engine";

/** Runs a workflow server-side: llm nodes use Nemotron on Nebius; check nodes run in the sandbox. */
export const runWorkflowFn = createServerFn({ method: "POST" })
  .validator((input: { workflow: Workflow; input: string; files: Record<string, string> }) => input)
  .handler(async ({ data }): Promise<WfResult> => {
    const { runWorkflow } = await import("./engine");
    const { liveDeps } = await import("./deps.server");
    const files = Object.fromEntries(Object.entries(data.files ?? {}).slice(0, 80));
    return runWorkflow(data.workflow, (data.input ?? "").slice(0, 6000), files, liveDeps());
  });
