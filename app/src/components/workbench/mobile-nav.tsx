import { FolderCode, LayoutDashboard, MessageSquare, SquarePen } from "lucide-react";
import type { MobileTab } from "@/lib/agent/types";
import { useWork } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS: { id: MobileTab; label: string; icon: typeof MessageSquare }[] = [
  { id: "home", label: "New", icon: SquarePen },
  { id: "task", label: "Task", icon: MessageSquare },
  { id: "files", label: "Files", icon: FolderCode },
  { id: "more", label: "Board", icon: LayoutDashboard },
];

export function MobileNav() {
  const tab = useWork((s) => s.mobileTab);
  const setTab = useWork((s) => s.setMobileTab);
  const setActivity = useWork((s) => s.setActivity);
  return (
    <nav className="grid h-14 grid-cols-4 border-t border-border bg-sidebar md:hidden">
      {TABS.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              if (t.id === "home") setActivity("home");
              if (t.id === "files") setActivity("files");
              if (t.id === "more") setActivity("dashboard");
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-xs",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
