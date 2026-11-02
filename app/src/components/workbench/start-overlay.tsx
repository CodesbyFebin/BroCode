import { FolderOpen } from "lucide-react";
import { SUGGESTED_JOBS } from "@/lib/agent/seed";
import { runTurn } from "@/lib/agent/run";
import { useWork } from "@/lib/store";
import { Buddy } from "@/components/logo";
import { Composer } from "./composer";

export function NewTaskHome({ inputId = "job" }: { inputId?: string }) {
  const sessions = useWork((s) => s.sessions);
  const currentId = useWork((s) => s.currentId);
  const switchSession = useWork((s) => s.switchSession);
  const setActivity = useWork((s) => s.setActivity);

  return (
    <div className="paper-grain h-full min-h-0 flex-1 overflow-auto">
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-5 py-10">
        <div className="stagger-in space-y-6">
          <div className="flex items-center gap-3">
            <Buddy />
            <div>
              <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                Let's take something off your list
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Beta preview
              </p>
            </div>
          </div>

          <Composer inputId={inputId} />

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="size-4" />
              <span className="sr-only">Choose a project</span>
              <select
                value={currentId}
                onChange={(e) => switchSession(e.target.value)}
                className="h-9 rounded-full bg-card px-3 text-sm text-foreground shadow-[var(--shadow-border)]"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="h-9 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setActivity("files")}
            >
              Open workbench
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTED_JOBS.map((job) => (
              <button
                key={job.title}
                type="button"
                onClick={() => void runTurn(job.prompt)}
                className="rounded-lg bg-card p-4 text-left shadow-[var(--shadow-border)] transition-[box-shadow,transform] duration-150 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.98]"
              >
                <div className="text-sm font-medium text-foreground">{job.title}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {job.prompt}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const StartOverlay = NewTaskHome;
