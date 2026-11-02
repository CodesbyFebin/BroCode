import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createTaskFn, listTasksFn, runNextFn, runsFn } from "@/lib/board/board";
import type { Run, Task, TaskStatus } from "@/lib/board/repo";
import { runHandoffFn } from "@/lib/collab/collab";
import type { HandoffResult } from "@/lib/collab/handoff";
import { useSession } from "@/lib/store";
import { WindowControls } from "@/components/ui/window-controls";
import { Maximize2, Minimize2, X } from "lucide-react";

function HandoffSection() {
  const session = useSession();
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<HandoffResult | null>(null);
  const go = async () => {
    setBusy(true); setErr(""); setRes(null);
    try {
      const files = Object.fromEntries(Object.values(session.files ?? {}).map((f) => [f.path, f.content]));
      setRes(await runHandoffFn({ data: { goal, files } }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="mt-8 rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
      <h2 className="font-medium">Builder → Reviewer handoff</h2>
      <p className="text-xs text-muted-foreground">Nemotron Super implements; Nemotron Ultra reviews read-only and can send it back (role pattern from Ensemble, MIT).</p>
      <div className="mt-2 flex gap-2">
        <input aria-label="Handoff goal" className="flex-1 rounded border bg-background px-3 py-2 text-sm" placeholder="Goal" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <Button disabled={busy || !goal.trim()} onClick={() => void go()}>{busy ? "Working…" : "Start"}</Button>
      </div>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      {res ? (
        <ol className="mt-3 grid gap-2 text-sm">
          <li className="font-mono">{res.status} · {res.rounds} round(s)</li>
          {res.log.map((l, i) => (
            <li key={i}><b>{l.participant}</b> · {l.task} #{l.attempt}<pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs">{l.output}</pre></li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

const COLS: TaskStatus[] = ["queued", "running", "done", "failed"];

export function BoardPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<{ task: Task; runs: Run[] } | null>(null);
  const [wide, setWide] = useState(false);

  const refresh = useCallback(async () => {
    try { setTasks(await listTasksFn()); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const add = async () => {
    if (!title.trim()) return;
    setErr("");
    try {
      await createTaskFn({ data: { title, prompt, workflowId: workflowId.trim() || null } });
      setTitle(""); setPrompt(""); setWorkflowId("");
      await refresh();
    } catch (e) { setErr((e as Error).message); }
  };
  const tick = async () => {
    setBusy(true); setErr("");
    try { await runNextFn(); } catch (e) { setErr((e as Error).message); }
    await refresh(); setBusy(false);
  };
  const show = async (task: Task) => setOpen({ task, runs: await runsFn({ data: { taskId: task.id } }) });

  return (
    <div className="code-scroll h-full overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl tracking-tight">Task board</h1>
        <p className="mt-1 text-sm text-muted-foreground">Assign tasks to Nemotron (or a saved workflow). The runner claims the oldest queued task and records each run.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_12rem_auto_auto]">
          <input aria-label="Task title" className="rounded border bg-background px-3 py-2 text-sm" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input aria-label="Task prompt" className="rounded border bg-background px-3 py-2 text-sm" placeholder="Prompt / details" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <input aria-label="Workflow id" className="rounded border bg-background px-3 py-2 font-mono text-sm" placeholder="workflow id (optional)" value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} />
          <Button onClick={() => void add()}>Add</Button>
          <Button variant="outline" disabled={busy} onClick={() => void tick()}>{busy ? "Running…" : "Run next"}</Button>
        </div>
        {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {COLS.map((c) => (
            <section key={c} className="rounded-lg bg-card p-3 shadow-[var(--shadow-border)]">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c} · {tasks.filter((t) => t.status === c).length}</h2>
              <ul className="grid gap-2">
                {tasks.filter((t) => t.status === c).map((t) => (
                  <li key={t.id}>
                    <button className="w-full rounded border bg-background p-2 text-left text-sm hover:bg-muted" onClick={() => void show(t)}>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.workflow_id ? `workflow ${t.workflow_id}` : t.assignee}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {open ? (
          <div className="mt-6 rounded-lg bg-card p-4 text-sm shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between"><b>{open.task.title}</b><WindowControls className="[&_button]:bg-muted" onClose={() => setOpen(null)} onMaximize={() => setWide((w) => !w)} closeIcon={<X className="size-3" />} maximizeIcon={wide ? <Minimize2 className="size-3" /> : <Maximize2 className="size-3" />} /></div>
            {open.runs.length === 0 ? <p className="mt-2 text-muted-foreground">No runs yet.</p> : open.runs.map((r) => (
              <div key={r.id} className="mt-2"><span className="font-mono">{r.status}</span> {r.model ?? ""}<pre className={`mt-1 overflow-auto whitespace-pre-wrap text-xs ${wide ? "max-h-[70vh]" : "max-h-60"}`}>{r.output}</pre></div>
            ))}
          </div>
        ) : null}
        <HandoffSection />
      </div>
    </div>
  );
}
