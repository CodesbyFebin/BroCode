import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/agent/nebius";
import { ideaToDeployReady, type MeridianResult } from "@/lib/meridian/meridian";
import { useSession, useWork } from "@/lib/store";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  fail: "text-red-600",
  skipped: "text-muted-foreground",
};

export function MeridianPanel() {
  const session = useSession();
  const upsertFile = useWork((s) => s.upsertFile);
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<MeridianResult | null>(null);
  const [applied, setApplied] = useState(false);

  const run = async () => {
    setBusy(true);
    setErr("");
    setApplied(false);
    try {
      const files = Object.fromEntries(Object.values(session.files ?? {}).map((f) => [f.path, f.content]));
      setRes(await ideaToDeployReady({ data: { idea, files } }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const apply = () => {
    if (!res) return;
    for (const p of res.changed) upsertFile(p, res.files[p]);
    setApplied(true);
  };
  const total = res?.steps.reduce((a, s) => a + (s.costUsd ?? 0), 0) ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 text-sm">
      <div className="font-medium">Idea → deploy-ready (MERIDIAN)</div>
      <p className="text-xs text-muted-foreground">
        Planner → Architect → Coder → Tester → Security → Compliance → Pipeline → GreenOps. Without NEBIUS_API_KEY the LLM agents are skipped and the rest run on the current workspace.
      </p>
      <textarea
        className="min-h-24 rounded-md border bg-background p-2 text-xs"
        placeholder="Describe the product idea…"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
      />
      <Button size="sm" onClick={run} disabled={busy}>{busy ? "Running agents…" : "Run idea → deploy-ready"}</Button>
      {err ? <div className="text-xs text-red-600">{err}</div> : null}
      {res ? (
        <>
          <div className={cn("rounded-md border p-2 text-xs font-medium", res.deployReady ? "text-emerald-600" : "text-amber-600")}>
            {res.deployReady ? "Deploy-ready: tests pass, no blocking security findings." : "Not deploy-ready yet — see failing agents below."}
            {total > 0 ? ` · LLM cost ${formatUsd(total)}` : ""}
          </div>
          {res.steps.map((s, i) => (
            <details key={i} className="rounded-md border p-2" open={s.status === "fail"}>
              <summary className="cursor-pointer text-xs">
                <span className={cn("font-medium", TONE[s.status])}>{s.status.toUpperCase()}</span> {s.agent} — {s.summary}
                {s.model ? <span className="text-muted-foreground"> · {s.model}</span> : null}
              </summary>
              {s.evidence ? <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px]">{s.evidence}</pre> : null}
            </details>
          ))}
          {res.changed.length ? (
            <div className="flex flex-col gap-1 text-xs">
              <div>Changed files: {res.changed.join(", ")}</div>
              <Button size="sm" variant="outline" onClick={apply} disabled={applied}>{applied ? "Applied to workspace" : "Apply to workspace"}</Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
