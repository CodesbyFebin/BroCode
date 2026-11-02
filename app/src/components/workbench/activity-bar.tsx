import {
  Blocks,
  CalendarClock,
  Files,
  LayoutDashboard,
  Sparkles,
  ShieldAlert,
  Rocket,
  GitPullRequest,
  SquarePen,
  Workflow,
  Network,
  KanbanSquare,
} from "lucide-react";
import type { ActivityId } from "@/lib/agent/types";
import { useWork } from "@/lib/store";
import { cn } from "@/lib/utils";

const ITEMS: { id: ActivityId; label: string; icon: typeof Files }[] = [
  { id: "home", label: "New task", icon: SquarePen },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "files", label: "Files", icon: Files },
  { id: "skills", label: "Skills", icon: Sparkles },
  { id: "cron", label: "Scheduled", icon: CalendarClock },
  { id: "pipeline", label: "Ship pipeline", icon: Workflow },
  { id: "redteam", label: "Red-team my agent", icon: ShieldAlert },
  { id: "meridian", label: "Idea to deploy-ready", icon: Rocket },
  { id: "whisperer", label: "CI Whisperer / Project DNA", icon: GitPullRequest },
  { id: "workflows", label: "Workflows", icon: Network },
  { id: "board", label: "Task board", icon: KanbanSquare },
  { id: "plugins", label: "Plugins", icon: Blocks },
];

export function ActivityBar() {
  const activity = useWork((s) => s.activity);
  const setActivity = useWork((s) => s.setActivity);
  const newSession = useWork((s) => s.newSession);

  return (
    <nav
      aria-label="Workbench"
      className="hidden w-12 shrink-0 flex-col items-center border-r border-border bg-sidebar py-2 md:flex"
    >
      <div className="flex flex-1 flex-col items-center gap-1">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activity === item.id;
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => setActivity(item.id)}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150",
                active ? "bg-secondary text-primary" : "hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        title="New task"
        aria-label="New task"
        onClick={() => newSession()}
        className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <SquarePen className="size-4" />
      </button>
    </nav>
  );
}
