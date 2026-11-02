import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsd } from "@/lib/agent/nebius";
import { DANGEROUS_MIGRATION, SAFE_MIGRATION } from "@/lib/pipeline/demo";
import { deployPreview, listShadowPreviews, runPipeline, teardownShadowPreview, type PipelineResult } from "@/lib/pipeline/pipeline";
import type { PreviewInfo } from "@/lib/pipeline/shadow.server";
import { useSession } from "@/lib/store";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  fail: "text-red-600",
  blocked: "text-red-600",
  skipped: "text-muted-foreground",
};

export function PipelinePanel() {
  const session = useSession();
  const [sql, setSql] = useState(SAFE_MIGRATION);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<PipelineResult | null>(null);
  const [previews, setPreviews] = useState<PreviewInfo[]>([]);
  const [confirm, setConfirm] = useState("");
  const [deployMsg, setDeployMsg] = useState("");

  const refresh = async () => setPreviews(await listShadowPreviews());
  const run = async () => {
    setBusy(true);
    setDeployMsg("");
    try {
      const files = Object.fromEntries(Object.values(session.files ?? {}).map((f) => [f.path, f.content]));
      setRes(await runPipeline({ data: { migrationSql: sql, prompt, files } }));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="code-scroll h-full overflow-auto p-6" data-testid="pipeline-panel">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Ship pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Architect → Migration Auditor → Gate → Data Smith → Shadow preview (PGlite) → Smoke Tester → Deployer (human-confirmed).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSql(SAFE_MIGRATION)}>Demo: safe migration</Button>
          <Button variant="outline" onClick={() => setSql(DANGEROUS_MIGRATION)}>Demo: dangerous migration</Button>
          <Button variant="outline" onClick={() => setSql("")}>Clear (design from prompt)</Button>
        </div>
        <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={10} placeholder="Paste migration SQL…" className="w-full rounded-md bg-card p-3 font-mono text-xs shadow-[var(--shadow-border)]" />
        {!sql.trim() ? <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the app; Nemotron Super designs the schema" /> : null}
        <Button onClick={run} disabled={busy}>{busy ? "Running…" : "Run full pipeline"}</Button>

        {res ? (
          <ol className="space-y-2" data-testid="pipeline-steps">
            {res.steps.map((s, i) => (
              <li key={i} className="rounded-md bg-card p-3 text-sm shadow-[var(--shadow-border)]">
                <div className="flex justify-between gap-2">
                  <span><span className={cn("font-mono uppercase", TONE[s.status])}>{s.status}</span> · <b>{s.name}</b> — {s.summary}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {s.model ? `${s.model.split("/").pop()} · ` : ""}{s.costUsd != null ? `${formatUsd(s.costUsd)} · ` : ""}{s.ms}ms
                  </span>
                </div>
                {s.evidence ? (
                  <details className="mt-1"><summary className="cursor-pointer text-xs text-muted-foreground">evidence</summary>
                    <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{s.evidence}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}

        {res?.preview ? (
          <div className="space-y-2 rounded-md bg-card p-3 text-sm shadow-[var(--shadow-border)]">
            <b>Deployer</b>
            <p className="text-xs text-muted-foreground">Verdict {res.preview.verdict}. Type DEPLOY to confirm. Without DEPLOY_HOOK_URL this is a dry run.</p>
            <div className="flex gap-2">
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DEPLOY" />
              <Button variant="outline" onClick={async () => setDeployMsg((await deployPreview({ data: { id: res.preview!.id, confirm } })).message)}>Deploy</Button>
            </div>
            {deployMsg ? <p className="text-xs">{deployMsg}</p> : null}
          </div>
        ) : null}

        <div className="rounded-md bg-card p-3 text-sm shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between"><b>Preview Manager</b><Button variant="outline" onClick={refresh}>Refresh</Button></div>
          <ul className="mt-2 space-y-1 text-xs">
            {previews.length ? previews.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span className="font-mono">{p.id} · {p.verdict} {p.score}/10 · smoke {p.smokeOk ? "pass" : "fail"} · expires {new Date(p.expiresAt).toLocaleTimeString()}</span>
                <Button variant="outline" onClick={async () => { await teardownShadowPreview({ data: { id: p.id } }); await refresh(); }}>Tear down</Button>
              </li>
            )) : <li className="text-muted-foreground">No live previews.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
