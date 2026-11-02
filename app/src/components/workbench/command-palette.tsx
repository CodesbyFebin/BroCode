import { useEffect, useMemo, useState } from "react";
import { useWork } from "@/lib/store";
import type { ActivityId, WorkMode } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

type Cmd = { id: string; label: string; hint?: string; run: () => void };

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const newSession = useWork((s) => s.newSession);
  const patch = useWork((s) => s.patchSettings);
  const setActivity = useWork((s) => s.setActivity);
  const undoFiles = useWork((s) => s.undoFiles);
  const setAppMode = useWork((s) => s.setAppMode);

  const commands = useMemo<Cmd[]>(
    () => [
      { id: "new", label: "New task", run: () => newSession() },
      { id: "home", label: "New task screen", run: () => setActivity("home" as ActivityId) },
      { id: "dash", label: "Dashboard", run: () => setActivity("dashboard") },
      { id: "files", label: "Workbench files", run: () => setActivity("files") },
      { id: "skills", label: "Skills", run: () => setActivity("skills") },
      { id: "cron", label: "Scheduled tasks", run: () => setActivity("cron") },
      { id: "web", label: "WebBridge", run: () => setActivity("webbridge") },
      { id: "plugins", label: "Plugins", run: () => setActivity("plugins") },
      { id: "pipeline", label: "Run full pipeline", run: () => setActivity("pipeline") },
      { id: "redteam", label: "Red-team my agent", run: () => setActivity("redteam") },
      { id: "meridian", label: "Idea to deploy-ready", run: () => setActivity("meridian") },
      { id: "workflows", label: "Workflows", run: () => setActivity("workflows") },
      { id: "board", label: "Task board", run: () => setActivity("board") },
      { id: "whisperer", label: "CI Whisperer / Project DNA", run: () => setActivity("whisperer") },
      { id: "memory", label: "Memory", run: () => setActivity("memory") },
      { id: "mode-work", label: "Mode: Work", run: () => setAppMode("work") },
      { id: "mode-chat", label: "Mode: Chat", run: () => setAppMode("chat") },
      { id: "agent-swarm", label: "Agent Swarm", run: () => patch({ mode: "swarm" as WorkMode }) },
      { id: "agent", label: "Agent", run: () => patch({ mode: "chat" }) },
      { id: "plan", label: "Plan", run: () => patch({ mode: "plan" }) },
      { id: "undo", label: "Undo last edit", run: () => undoFiles() },
    ],
    [newSession, patch, setActivity, setAppMode, undoFiles],
  );

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-foreground/20 px-4 pt-24" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-card shadow-[var(--shadow-composer)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type a command"
          className="h-12 w-full bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered[0]) {
              filtered[0].run();
              onClose();
            }
          }}
        />
        <ul className="max-h-72 overflow-auto border-t border-border p-1">
          {filtered.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                className={cn(
                  "flex min-h-10 w-full items-center px-3 text-left text-sm text-foreground hover:bg-secondary",
                  i === 0 && "bg-secondary/70",
                )}
                onClick={() => {
                  c.run();
                  onClose();
                }}
              >
                {c.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
