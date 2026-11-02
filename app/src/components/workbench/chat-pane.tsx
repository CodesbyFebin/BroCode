import { useEffect, useRef } from "react";
import { modelLabel } from "@/lib/agent/providers";
import { useSession, useWork } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { DiffBlock } from "./diff-block";
import { MessageEvidence } from "./evidence";
import { Composer } from "./composer";
import { SwarmConstellation } from "./swarm-view";
import { cn } from "@/lib/utils";

export function ChatPane({ inputId = "job-thread" }: { inputId?: string }) {
  const session = useSession();
  const mode = useWork((s) => s.settings.mode);
  const applyPending = useWork((s) => s.applyPending);
  const rejectPending = useWork((s) => s.rejectPending);
  const scroller = useRef<HTMLDivElement>(null);
  const pending = session.pending ?? [];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [session.messages.length, session.swarm.running, pending.length]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex h-12 items-center justify-between px-4">
        <span className="text-sm font-medium text-foreground">{session.title}</span>
        <span className="text-xs capitalize text-muted-foreground">
          {mode === "swarm" ? "Agent Swarm" : mode}
        </span>
      </div>
      <div ref={scroller} className="code-scroll min-h-0 flex-1 space-y-5 overflow-auto px-4 py-2">
        {session.messages.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Describe a job. The agent plans, edits the workspace, and keeps memory.
          </p>
        ) : null}
        {session.messages.map((m) => (
          <article key={m.id} className="space-y-2">
            <div className="text-xs text-muted-foreground">
              {m.role === "user" ? "You" : "Agent"}
              {m.routed ? ` · ${modelLabel(m.routed.providerId, m.routed.model)}` : ""}
            </div>
            <div
              className={cn(
                "whitespace-pre-wrap text-sm leading-relaxed",
                m.role === "user" ? "text-foreground" : "text-foreground/90",
              )}
            >
              {m.content}
            </div>
            {m.artifacts?.map((a) => (
              <DiffBlock
                key={`${m.id}-${a.path}-${a.action}`}
                change={a}
                before={session.snapshots.at(-1)?.files[a.path]}
              />
            ))}
            <MessageEvidence m={m} />
          </article>
        ))}
        {session.swarm.running ? (
          <div className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
            <div className="mb-2 flex items-center gap-2 text-xs text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Working
            </div>
            <SwarmConstellation agents={session.swarm.agents} />
            <div className="shimmer mt-2 h-px w-full rounded-full" />
          </div>
        ) : null}
        {pending.length ? (
          <div className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
            <p className="text-sm font-medium">Permission needed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pending.length} file change{pending.length === 1 ? "" : "s"} will write to the workspace.
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => applyPending()}>Allow</Button>
              <Button variant="outline" onClick={() => rejectPending()}>
                Deny
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="p-3">
        <Composer compact inputId={inputId} />
      </div>
    </aside>
  );
}
