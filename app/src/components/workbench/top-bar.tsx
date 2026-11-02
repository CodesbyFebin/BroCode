import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { fallbackRoute, modelLabel } from "@/lib/agent/providers";
import type { WorkMode } from "@/lib/agent/types";
import { useSession, useWork } from "@/lib/store";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MODES: WorkMode[] = ["swarm", "plan", "chat"];

export function TopBar({ onCommand }: { onCommand: () => void }) {
  const session = useSession();
  const settings = useWork((s) => s.settings);
  const patch = useWork((s) => s.patchSettings);
  const rename = useWork((s) => s.renameSession);
  const route = fallbackRoute(settings);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-sidebar px-3">
      <Wordmark compact />
      <div className="hidden h-5 w-px bg-border sm:block" />
      <div className="min-w-0 flex-1">
        {editing ? (
          <form
            className="flex max-w-sm items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              rename(session.id, title);
              setEditing(false);
            }}
          >
            <Input
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              className="h-8"
            />
            <Button type="submit" size="icon-sm" variant="ghost" aria-label="Save title">
              <Check className="size-4" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            className="flex min-h-10 max-w-full items-center gap-2 text-left text-sm text-foreground"
            onClick={() => {
              setTitle(session.title);
              setEditing(true);
            }}
          >
            <span className="truncate">{session.title}</span>
            <Pencil className="size-3 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="hidden rounded-sm bg-secondary p-0.5 md:flex">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => patch({ mode: m })}
            className={cn(
              "h-8 px-3 text-xs capitalize",
              settings.mode === m ? "rounded-xs bg-card text-foreground" : "text-muted-foreground",
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={onCommand}>
        Commands
        <kbd className="ml-1 text-xs text-muted-foreground">⌘K</kbd>
      </Button>
      <span className="hidden font-mono text-xs text-muted-foreground lg:inline">
        {modelLabel(route.providerId, route.model)}
      </span>
    </header>
  );
}
