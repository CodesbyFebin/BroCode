import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { claimNext, createTask, drain, getWorkflow, listRuns, listTasks, runNext, saveWorkflow, type Q } from "../src/lib/board/repo";

async function fresh(): Promise<Q> {
  const pg = new PGlite();
  await pg.exec(readFileSync(new URL("../migrations/0002_platform.sql", import.meta.url), "utf8"));
  return { query: async (t, p) => (await pg.query(t, p)).rows as never };
}

test("migration creates default workspace; tasks are FIFO-claimed", async () => {
  const db = await fresh();
  const a = await createTask(db, { title: "first" });
  await createTask(db, { title: "second" });
  assert.equal(a.status, "queued");
  const c = await claimNext(db);
  assert.equal(c?.title, "first");
  assert.equal(c?.status, "running");
  assert.equal((await claimNext(db))?.title, "second");
  assert.equal(await claimNext(db), null);
  await assert.rejects(createTask(db, { title: "  " }));
});

test("runner records ok and failed runs, executor exceptions never strand a task", async () => {
  const db = await fresh();
  await createTask(db, { title: "good" });
  await createTask(db, { title: "bad" });
  await createTask(db, { title: "boom" });
  const res = await drain(db, async (t) => {
    if (t.title === "boom") throw new Error("kaput");
    return { ok: t.title === "good", output: `did ${t.title}`, model: "test" };
  });
  assert.deepEqual(res.map((r) => r.run.status), ["ok", "fail", "fail"]);
  const tasks = await listTasks(db);
  assert.deepEqual(tasks.map((t) => t.status), ["done", "failed", "failed"]);
  const runs = await listRuns(db, tasks[2].id);
  assert.match(runs[0].output, /kaput/);
  assert.ok(runs[0].finished_at);
  assert.equal(await runNext(db, async () => ({ ok: true, output: "" })), null);
});

test("workflows upsert and tasks can reference them", async () => {
  const db = await fresh();
  await saveWorkflow(db, { id: "wf1", name: "v1", definition: { nodes: [] } });
  await saveWorkflow(db, { id: "wf1", name: "v2", definition: { nodes: [1] } });
  const w = await getWorkflow(db, "wf1");
  assert.equal(w?.name, "v2");
  assert.deepEqual(w?.definition, { nodes: [1] });
  const t = await createTask(db, { title: "x", workflowId: "wf1" });
  assert.equal(t.workflow_id, "wf1");
});
