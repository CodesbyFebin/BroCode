import { useState } from "react";
import { runTurn } from "@/lib/agent/run";
import type { CronCadence } from "@/lib/agent/types";
import { useWork } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { relativeTime } from "@/lib/utils";

const CADENCE: CronCadence[] = ["hourly", "daily", "weekly"];

export function CronPanel() {
  const jobs = useWork((s) => s.cronJobs);
  const addCron = useWork((s) => s.addCron);
  const patchCron = useWork((s) => s.patchCron);
  const deleteCron = useWork((s) => s.deleteCron);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [cadence, setCadence] = useState<CronCadence>("daily");

  return (
    <div className="code-scroll h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl tracking-tight">Scheduled Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jobs run in this tab while it stays open. Toggle Keep awake on a job to arm it.
        </p>
        <form
          className="mt-6 space-y-3 rounded-lg bg-card p-5 shadow-[var(--shadow-border)]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !prompt.trim()) return;
            addCron({ title: title.trim(), prompt: prompt.trim(), cadence, enabled: false });
            setTitle("");
            setPrompt("");
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title" />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="What should the agent do?"
            className="w-full rounded-md bg-secondary px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as CronCadence)}
              className="h-10 rounded-md bg-secondary px-3 text-sm"
            >
              {CADENCE.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button type="submit">Add job</Button>
          </div>
        </form>
        <ul className="mt-4 space-y-3">
          {jobs.map((job) => (
            <li key={job.id} className="rounded-lg bg-card p-5 shadow-[var(--shadow-border)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">{job.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{job.prompt}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {job.cadence}
                    {job.lastRunAt ? ` · last ${relativeTime(job.lastRunAt)}` : " · not run yet"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={job.enabled ? "default" : "outline"}
                    onClick={() => patchCron(job.id, { enabled: !job.enabled, lastRunAt: Date.now() })}
                  >
                    {job.enabled ? "Armed" : "Arm"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      patchCron(job.id, { lastRunAt: Date.now() });
                      void runTurn(job.prompt);
                    }}
                  >
                    Run now
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCron(job.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
