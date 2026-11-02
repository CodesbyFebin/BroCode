/** Board repository over the shared Sql surface (Neon or PGLite). */
export interface Q {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}
export type TaskStatus = "queued" | "running" | "done" | "failed";
export interface Task {
  id: string; workspace_id: string; title: string; prompt: string; assignee: string;
  workflow_id: string | null; status: TaskStatus; created_at: string; updated_at: string;
}
export interface Run {
  id: string; task_id: string; status: "running" | "ok" | "fail"; output: string;
  model: string | null; started_at: string; finished_at: string | null;
}
const id = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function createTask(db: Q, t: { title: string; prompt?: string; assignee?: string; workflowId?: string | null; workspaceId?: string }): Promise<Task> {
  if (!t.title.trim()) throw new Error("title required");
  const [row] = await db.query<Task>(
    "insert into tasks (id, workspace_id, title, prompt, assignee, workflow_id) values ($1,$2,$3,$4,$5,$6) returning *",
    [id("tsk"), t.workspaceId ?? "default", t.title.trim(), t.prompt ?? "", t.assignee ?? "nemotron", t.workflowId ?? null],
  );
  return row;
}
export function listTasks(db: Q, workspaceId = "default"): Promise<Task[]> {
  return db.query<Task>("select * from tasks where workspace_id = $1 order by created_at", [workspaceId]);
}
export function listRuns(db: Q, taskId: string): Promise<Run[]> {
  return db.query<Run>("select * from runs where task_id = $1 order by started_at desc", [taskId]);
}
/** Atomically move the oldest queued task to running. Null when the queue is empty. */
export async function claimNext(db: Q, workspaceId = "default"): Promise<Task | null> {
  const rows = await db.query<Task>(
    `update tasks set status = 'running', updated_at = now()
       where id = (select id from tasks where workspace_id = $1 and status = 'queued'
                   order by created_at limit 1 for update skip locked)
       and status = 'queued' returning *`,
    [workspaceId],
  );
  return rows[0] ?? null;
}
export async function setStatus(db: Q, taskId: string, status: TaskStatus): Promise<void> {
  await db.query("update tasks set status = $2, updated_at = now() where id = $1", [taskId, status]);
}
export async function saveWorkflow(db: Q, w: { id: string; name: string; definition: unknown; workspaceId?: string }): Promise<void> {
  await db.query(
    `insert into workflows (id, workspace_id, name, definition) values ($1,$2,$3,$4)
     on conflict (id) do update set name = excluded.name, definition = excluded.definition, updated_at = now()`,
    [w.id, w.workspaceId ?? "default", w.name, JSON.stringify(w.definition)],
  );
}
export async function getWorkflow(db: Q, wid: string): Promise<{ id: string; name: string; definition: unknown } | null> {
  const r = await db.query<{ id: string; name: string; definition: unknown }>("select id, name, definition from workflows where id = $1", [wid]);
  return r[0] ?? null;
}

export type Executor = (task: Task) => Promise<{ ok: boolean; output: string; model?: string }>;

/**
 * Daemon-style runner step: claim one queued task, record a run, execute,
 * and settle both. Executor exceptions become failed runs, never stuck tasks.
 */
export async function runNext(db: Q, exec: Executor, workspaceId = "default"): Promise<{ task: Task; run: Run } | null> {
  const task = await claimNext(db, workspaceId);
  if (!task) return null;
  const runId = id("run");
  await db.query("insert into runs (id, task_id, status) values ($1,$2,'running')", [runId, task.id]);
  let ok = false, output = "", model: string | null = null;
  try {
    const r = await exec(task);
    ok = r.ok; output = r.output; model = r.model ?? null;
  } catch (e) {
    output = `error: ${(e as Error).message}`;
  }
  const [run] = await db.query<Run>(
    "update runs set status = $2, output = $3, model = $4, finished_at = now() where id = $1 returning *",
    [runId, ok ? "ok" : "fail", output.slice(0, 20000), model],
  );
  await setStatus(db, task.id, ok ? "done" : "failed");
  return { task: { ...task, status: ok ? "done" : "failed" }, run };
}
/** Drain up to `max` tasks. */
export async function drain(db: Q, exec: Executor, max = 10, workspaceId = "default") {
  const out: { task: Task; run: Run }[] = [];
  for (let i = 0; i < max; i++) {
    const r = await runNext(db, exec, workspaceId);
    if (!r) break;
    out.push(r);
  }
  return out;
}
