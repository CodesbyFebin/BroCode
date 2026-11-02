import { Plus, Trash2 } from "lucide-react";
import { useWork } from "@/lib/store";
import { relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SessionsPanel() {
  const sessions = useWork((s) => s.sessions);
  const currentId = useWork((s) => s.currentId);
  const switchSession = useWork((s) => s.switchSession);
  const newSession = useWork((s) => s.newSession);
  const deleteSession = useWork((s) => s.deleteSession);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Work
        </h2>
        <Button size="icon-sm" variant="ghost" aria-label="New work" onClick={() => newSession()}>
          <Plus className="size-4" />
        </Button>
      </div>
      <div className="code-scroll min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-4">
        {sessions.map((s) => (
          <div key={s.id} className="group flex items-center">
            <button
              type="button"
              onClick={() => switchSession(s.id)}
              className={cn(
                "min-h-12 flex-1 rounded-sm px-3 py-2 text-left",
                s.id === currentId ? "bg-secondary" : "hover:bg-secondary/70",
              )}
            >
              <div className="truncate text-sm text-foreground">{s.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {s.messages.length} turns · {relativeTime(s.updatedAt)}
              </div>
            </button>
            <button
              type="button"
              aria-label={`Delete ${s.title}`}
              className="size-8 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              onClick={() => deleteSession(s.id)}
            >
              <Trash2 className="mx-auto size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
