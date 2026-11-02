import { useSession, useWork } from "@/lib/store";
import { AGENTS } from "@/lib/agent/providers";
import { SwarmConstellation } from "./swarm-view";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const session = useSession();
  const cron = useWork((s) => s.cronJobs);
  const setActivity = useWork((s) => s.setActivity);
  const files = Object.keys(session.files).length;
  const done = session.swarm.agents.filter((a) => a.status === "done").length;

  return (
    <div className="code-scroll h-full overflow-auto p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Widgets for the current project, swarm, and scheduled work.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-lg bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Project</p>
            <h2 className="mt-2 text-lg font-medium">{session.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {files} files · {session.memories.length} memories · {session.messages.length} turns
            </p>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => setActivity("files")}>
              Open files
            </Button>
          </article>
          <article className="rounded-lg bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Swarm</p>
            <h2 className="mt-2 text-lg font-medium">
              {session.swarm.running ? "Running" : done ? `${done}/${AGENTS.length} done` : "Idle"}
            </h2>
            <div className="mt-3">
              <SwarmConstellation agents={session.swarm.agents} />
            </div>
          </article>
          <article className="rounded-lg bg-card p-5 shadow-[var(--shadow-border)]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Scheduled</p>
            <h2 className="mt-2 text-lg font-medium">
              {cron.filter((c) => c.enabled).length} live
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {cron.slice(0, 3).map((c) => (
                <li key={c.id}>
                  {c.title} · {c.cadence}
                </li>
              ))}
            </ul>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => setActivity("cron")}>
              Manage
            </Button>
          </article>
        </div>
        <div className="mt-4 rounded-lg bg-card p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Memory</p>
          <ul className="mt-3 space-y-2">
            {session.memories.slice(-4).map((m) => (
              <li key={m.id} className="text-sm leading-relaxed text-foreground">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{m.kind}</span>
                <p>{m.content}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
