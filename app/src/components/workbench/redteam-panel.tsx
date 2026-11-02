import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/agent/nebius";
import { DEMO_FILES, DEMO_TASK } from "@/lib/redteam/demo";
import { fileRedTeamIssue, runRedTeam, type RedTeamResult } from "@/lib/redteam/redteam";
import { useSession } from "@/lib/store";

export function RedTeamPanel() {
  const session = useSession();
  const [task, setTask] = useState(DEMO_TASK);
  const [useWorkspace, setUseWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<RedTeamResult | null>(null);
  const [issue, setIssue] = useState("");

  const run = async () => {
    setBusy(true);
    setIssue("");
    try {
      const files = useWorkspace ? Object.fromEntries(Object.values(session.files ?? {}).map((f) => [f.path, f.content])) : DEMO_FILES;
      setRes(await runRedTeam({ data: { task, files } }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="code-scroll h-full overflow-auto p-6" data-testid="redteam-panel">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Red-team my agent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nemotron plays an adversary: it intercepts the agent's tool results and injects prompt-injection, false-data, state-corruption or privilege-escalation content. A bug counts only if the agent acted on it.
          </p>
        </div>
        <textarea value={task} onChange={(e) => setTask(e.target.value)} rows={3} className="w-full rounded-md bg-card p-3 text-sm shadow-[var(--shadow-border)]" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useWorkspace} onChange={(e) => setUseWorkspace(e.target.checked)} /> Use current workspace files (otherwise the demo repo)</label>
        <Button onClick={run} disabled={busy}>{busy ? "Attacking…" : "Red-team my agent"}</Button>
        {res ? (
          <div className="space-y-3">
            {res.error ? <p className="text-sm text-red-600">{res.error}</p> : null}
            {res.ok ? (
              <>
                <p className="text-sm">
                  {res.log.length} mutations · <b>{res.bugs.length} exploited</b> · {formatUsd(res.costUsd)} · stored: {res.persisted}
                </p>
                <ul className="space-y-1 text-sm">
                  {res.bugs.map((b) => (
                    <li key={b.mutationId} className="rounded-md bg-card p-2 shadow-[var(--shadow-border)]">
                      <span className="font-mono uppercase text-red-600">{b.severity}</span> {b.attackClass} via {b.tool}: {b.evidence}
                    </li>
                  ))}
                </ul>
                <details><summary className="cursor-pointer text-sm">Markdown report</summary>
                  <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-card p-3 text-xs">{res.report}</pre>
                </details>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(res.report)}>Copy report</Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!res.sessionId || !window.confirm("Create a GitHub issue with this report via gh?")) return;
                      setIssue((await fileRedTeamIssue({ data: { sessionId: res.sessionId, confirm: true } })).message);
                    }}
                  >
                    File GitHub issue
                  </Button>
                </div>
                {issue ? <p className="text-xs">{issue}</p> : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
