import { formatUsd } from "@/lib/agent/nebius";
import { modelLabel } from "@/lib/agent/providers";
import type { ChatMessage } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

function label(model: string) {
  return model === "tavily" ? "Tavily" : modelLabel("nebius", model);
}

/** Per-step model + cost, Tavily citations, reviewer notes and sandbox test evidence. */
export function MessageEvidence({ m }: { m: ChatMessage }) {
  const trace = m.trace ?? [];
  const total = trace.reduce((a, t) => a + t.costUsd, 0);
  const v = m.verification;
  return (
    <div className="space-y-2">
      {trace.length ? (
        <div className="rounded-md bg-card p-2 text-xs shadow-[var(--shadow-border)]" data-testid="trace">
          <div className="mb-1 flex justify-between text-muted-foreground">
            <span>Model routing</span>
            <span>total {formatUsd(total)}</span>
          </div>
          <ul className="space-y-0.5">
            {trace.map((t, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{t.label}</span>
                <span className="shrink-0 font-mono text-muted-foreground">
                  {label(t.model)} · {t.tokens ? `${t.tokens} tok · ` : ""}
                  {formatUsd(t.costUsd)}
                  {t.ms ? ` · ${(t.ms / 1000).toFixed(1)}s` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {m.review ? (
        <div className="rounded-md bg-card p-2 text-xs shadow-[var(--shadow-border)]">
          <div className="mb-1 text-muted-foreground">Reviewer (Nemotron Nano)</div>
          <div className="whitespace-pre-wrap">{m.review}</div>
        </div>
      ) : null}
      {v ? (
        <div className="rounded-md bg-card p-2 text-xs shadow-[var(--shadow-border)]" data-testid="verification">
          <div className={cn("mb-1 font-medium", v.passed ? "text-emerald-500" : "text-red-500")}>
            {v.passed ? "✓ Tests pass" : "✗ Tests failing"} · <code>{v.command}</code> · {v.attempts} run
            {v.attempts === 1 ? "" : "s"}
            {v.costUsd ? ` · repair ${formatUsd(v.costUsd)}` : ""}
          </div>
          {v.steps.map((st, i) => (
            <details key={i} className="mt-1">
              <summary className="cursor-pointer text-muted-foreground">
                {st.kind === "run"
                  ? `Run #${st.attempt} (${st.runner}) → exit ${st.exitCode} in ${(st.ms / 1000).toFixed(1)}s`
                  : st.kind === "repair"
                    ? `Repair #${st.attempt} by ${label(st.model)}: ${st.note || "patched"} [${st.paths.join(", ")}]`
                    : `Error: ${st.message}`}
              </summary>
              {st.kind === "run" ? (
                <pre className="code-scroll mt-1 max-h-48 overflow-auto rounded bg-background p-2 text-[11px]">{st.output}</pre>
              ) : null}
            </details>
          ))}
        </div>
      ) : null}
      {m.citations?.length ? (
        <div className="text-xs text-muted-foreground">
          Sources (Tavily):{" "}
          {m.citations.map((c, i) => (
            <a key={c.url} href={c.url} target="_blank" rel="noreferrer" className="mr-2 underline" title={c.snippet}>
              [{i + 1}] {c.title.slice(0, 50)}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
