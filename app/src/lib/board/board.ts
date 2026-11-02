import { createServerFn } from "@tanstack/react-start";
import type { Run, Task } from "./repo";

async function db() {
  const { getSql } = await import("../db");
  return getSql();
}

export const listTasksFn = createServerFn({ method: "GET" }).handler(async (): Promise<Task[]> => {
  const { listTasks } = await import("./repo");
  return listTasks(await db());
});
export const createTaskFn = createServerFn({ method: "POST" })
  .validator((d: { title: string; prompt: string; workflowId?: string | null }) => d)
  .handler(async ({ data }) => {
    const { createTask } = await import("./repo");
    return createTask(await db(), { title: data.title.slice(0, 200), prompt: data.prompt.slice(0, 8000), workflowId: data.workflowId ?? null });
  });
export const saveWorkflowFn = createServerFn({ method: "POST" })
  .validator((d: { id: string; name: string; definition: unknown }) => d)
  .handler(async ({ data }) => {
    const { saveWorkflow } = await import("./repo");
    await saveWorkflow(await db(), data);
    return { ok: true };
  });
export const runsFn = createServerFn({ method: "POST" })
  .validator((d: { taskId: string }) => d)
  .handler(async ({ data }): Promise<Run[]> => {
    const { listRuns } = await import("./repo");
    return listRuns(await db(), data.taskId);
  });

/** One runner tick: claim the oldest queued task and execute it (workflow or plain Nemotron prompt). */
export const runNextFn = createServerFn({ method: "POST" }).handler(async () => {
  const { runNext, getWorkflow } = await import("./repo");
  const { liveDeps } = await import("../workflow/deps.server");
  const { runWorkflow } = await import("../workflow/engine");
  const sql = await db();
  const deps = liveDeps();
  return runNext(sql, async (task) => {
    if (task.workflow_id) {
      const w = await getWorkflow(sql, task.workflow_id);
      if (!w) return { ok: false, output: `workflow ${task.workflow_id} not found` };
      const r = await runWorkflow(w.definition as never, task.prompt, {}, deps);
      return { ok: r.ok, output: r.steps.map((s) => `[${s.status}] ${s.node}: ${s.output.slice(0, 500)}`).join("\n") };
    }
    const r = await deps.llm(`${task.title}\n\n${task.prompt}`, "super");
    return { ok: true, output: r.text, model: r.model };
  });
});
