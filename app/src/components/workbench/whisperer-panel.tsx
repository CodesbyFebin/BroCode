import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auditOnMerge, explainCiFailure, extractProjectDNA, generateReleaseNotes, healCiFailure, reviewPullRequest } from "@/lib/whisperer/whisperer";
import { useSession, useWork } from "@/lib/store";

type Tab = "dna" | "review" | "ci" | "release" | "audit";
const TABS: [Tab, string][] = [["dna", "Project DNA"], ["review", "PR review"], ["ci", "CI failure"], ["release", "Release notes"], ["audit", "Config audit"]];

function Out({ text }: { text: string }) {
  return text ? <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border p-2 text-[11px]">{text}</pre> : null;
}

export function WhispererPanel() {
  const session = useSession();
  const upsertFile = useWork((s) => s.upsertFile);
  const files = () => Object.fromEntries(Object.values(session.files ?? {}).map((f) => [f.path, f.content]));
  const [tab, setTab] = useState<Tab>("dna");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState("");
  const [repo, setRepo] = useState("");
  const [num, setNum] = useState("");
  const [text, setText] = useState("");
  const [base, setBase] = useState("");
  const [head, setHead] = useState("");
  const [healed, setHealed] = useState<Record<string, string>>({});

  const go = async (fn: () => Promise<string>) => {
    setBusy(true);
    setOut("");
    setHealed({});
    try {
      setOut(await fn());
    } catch (e) {
      setOut(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  const remote = repo.trim() && Number(num) > 0 ? { repo: repo.trim(), n: Number(num) } : null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 text-sm">
      <div className="font-medium">CI Whisperer · PCM Lead Maintainer</div>
      <div className="flex flex-wrap gap-1">
        {TABS.map(([id, label]) => (
          <Button key={id} size="sm" variant={tab === id ? "default" : "outline"} onClick={() => { setTab(id); setOut(""); setText(""); }}>{label}</Button>
        ))}
      </div>

      {tab === "dna" ? (
        <>
          <p className="text-xs text-muted-foreground">Project DNA is extracted passively whenever a server agent sees the workspace, persisted server-side, and prepended to every Nemotron call. Other models can fetch it from <code>GET /api/dna</code> (Bearer PCM_DNA_TOKEN).</p>
          <Button size="sm" disabled={busy} onClick={() => go(async () => { const r = await extractProjectDNA({ data: { files: files() } }); return r.dna ? `${r.prompt}\n\n${JSON.stringify(r.dna, null, 2)}` : "Workspace is empty."; })}>Extract DNA now</Button>
        </>
      ) : null}

      {tab === "review" || tab === "ci" ? (
        <>
          <div className="flex gap-1">
            <Input className="h-8 text-xs" placeholder="owner/repo (optional, uses gh read-only)" value={repo} onChange={(e) => setRepo(e.target.value)} />
            <Input className="h-8 w-28 text-xs" placeholder={tab === "review" ? "PR #" : "run id"} value={num} onChange={(e) => setNum(e.target.value)} />
          </div>
          <textarea className="min-h-28 rounded-md border bg-background p-2 font-mono text-[11px]" placeholder={tab === "review" ? "…or paste a unified diff" : "…or paste the failing CI log"} value={text} onChange={(e) => setText(e.target.value)} />
        </>
      ) : null}
      {tab === "review" ? (
        <Button size="sm" disabled={busy} onClick={() => go(async () => { const r = await reviewPullRequest({ data: { diff: text || undefined, repo: remote?.repo, pr: remote?.n, files: files() } }); return r.ok ? r.markdown : `Error: ${r.error}`; })}>Review (Nano triage → Super analysis)</Button>
      ) : null}
      {tab === "ci" ? (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" disabled={busy} onClick={() => go(async () => { const r = await explainCiFailure({ data: { log: text || undefined, repo: remote?.repo, runId: remote?.n, files: files() } }); return r.ok ? r.markdown : `Error: ${r.error}`; })}>Explain failure (Super)</Button>
          <Button size="sm" variant="outline" disabled={busy || !text} title="Paste the log first" onClick={() => go(async () => {
            const r = await healCiFailure({ data: { files: files(), log: text } });
            if (!r.ok) return `Error: ${r.error}`;
            if (r.verified) setHealed(r.changedFiles);
            const steps = r.steps.map((s) => `• ${s.kind}${"exitCode" in s && s.exitCode != null ? ` exit ${s.exitCode}` : ""}${"note" in s && s.note ? ` — ${s.note}` : ""}`).join("\n");
            return `${r.message}\nCommand: ${r.command} · attempts: ${r.attempts}\n\n${steps}\n\n${r.patch || "(no patch)"}`;
          })}>Auto-heal (Ultra, sandbox-verified)</Button>
        </div>
      ) : null}
      {Object.keys(healed).length ? (
        <Button size="sm" variant="outline" onClick={() => { for (const [p, c] of Object.entries(healed)) upsertFile(p, c); setHealed({}); }}>Apply verified patch to workspace</Button>
      ) : null}

      {tab === "release" ? (
        <>
          <div className="flex gap-1">
            <Input className="h-8 text-xs" placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
            <Input className="h-8 w-24 text-xs" placeholder="base" value={base} onChange={(e) => setBase(e.target.value)} />
            <Input className="h-8 w-24 text-xs" placeholder="head" value={head} onChange={(e) => setHead(e.target.value)} />
          </div>
          <textarea className="min-h-24 rounded-md border bg-background p-2 font-mono text-[11px]" placeholder={"…or paste `git log --oneline` output"} value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="sm" disabled={busy} onClick={() => go(async () => {
            const commits = text.split("\n").map((l) => /^([0-9a-f]{7,40})\s+(.+)$/.exec(l.trim())).filter(Boolean).map((m) => ({ sha: m![1], message: m![2] }));
            const r = await generateReleaseNotes({ data: commits.length ? { commits } : { repo: repo.trim(), base: base.trim(), head: head.trim() } });
            return r.ok ? r.markdown : `Error: ${r.error}`;
          })}>Generate release notes</Button>
        </>
      ) : null}

      {tab === "audit" ? (
        <Button size="sm" disabled={busy} onClick={() => go(async () => { const r = await auditOnMerge({ data: { files: files() } }); return `${r.findings.length} findings · blocking: ${r.blocking ? "yes" : "no"}\n\n${r.findings.map((f) => `[${f.severity}] ${f.file}${f.line ? `:${f.line}` : ""} ${f.rule} — ${f.message}`).join("\n")}`; })}>Audit workspace (workflows, Docker, env, OWASP)</Button>
      ) : null}

      {busy ? <div className="text-xs text-muted-foreground">Working…</div> : null}
      <Out text={out} />
    </div>
  );
}
