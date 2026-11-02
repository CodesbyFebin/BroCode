import {
  Blocks,
  CalendarClock,
  Globe,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Sparkles,
  SquarePen,
} from "lucide-react";
import type { ActivityId, AppMode } from "@/lib/agent/types";
import { useWork } from "@/lib/store";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const NAV: { id: ActivityId; label: string; icon: typeof Plus }[] = [
  { id: "home", label: "New task", icon: SquarePen },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "plugins", label: "Plugins", icon: Blocks },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "cron", label: "Scheduled Tasks", icon: CalendarClock },
  { id: "webbridge", label: "WebBridge", icon: Globe },
];

const DOTS = ["bg-ice", "bg-primary", "bg-warn"];

export function WorkNav() {
  const activity = useWork((s) => s.activity);
  const setActivity = useWork((s) => s.setActivity);
  const appMode = useWork((s) => s.appMode);
  const setAppMode = useWork((s) => s.setAppMode);
  const newSession = useWork((s) => s.newSession);
  const sessions = useWork((s) => s.sessions);
  const currentId = useWork((s) => s.currentId);
  const switchSession = useWork((s) => s.switchSession);

  function go(id: ActivityId) {
    setAppMode("work");
    if (id === "home") {
      const cur = useWork.getState().current();
      if (cur.messages.length > 0) newSession();
      else setActivity("home");
      return;
    }
    setActivity(id);
  }

  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col bg-sidebar px-3 py-4">
      <div className="flex rounded-full bg-card p-1 shadow-[var(--shadow-border)]">
        {(["work", "chat"] as AppMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setAppMode(mode)}
            className={cn(
              "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-sm capitalize",
              appMode === mode ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            {mode === "work" ? <SquarePen className="size-3.5" /> : <MessageSquare className="size-3.5" />}
            {mode === "work" ? "Work" : "Chat"}
          </button>
        ))}
      </div>

      <nav className="mt-4 space-y-0.5" aria-label="Work">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = appMode === "work" && activity === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={cn(
                "flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm",
                active ? "bg-card text-foreground shadow-[var(--shadow-border)]" : "text-foreground/80 hover:bg-accent",
              )}
            >
              <Icon className="size-4 text-muted-foreground" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 px-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project</p>
      </div>
      <div className="mt-1 space-y-0.5">
        {sessions.slice(0, 4).map((s) => (
          <button
            key={`p-${s.id}`}
            type="button"
            onClick={() => switchSession(s.id)}
            className={cn(
              "flex min-h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm",
              s.id === currentId ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <span className="truncate">{s.title}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 px-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tasks</p>
      </div>
      <div className="code-scroll mt-1 min-h-0 flex-1 space-y-0.5 overflow-auto">
        {sessions.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => switchSession(s.id)}
            className={cn(
              "flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm",
              s.id === currentId ? "bg-accent" : "hover:bg-accent",
            )}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", DOTS[i % DOTS.length])} />
            <span className="min-w-0 flex-1 truncate text-foreground">{s.title}</span>
            <span className="text-xs text-muted-foreground">{relativeTime(s.updatedAt)}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
