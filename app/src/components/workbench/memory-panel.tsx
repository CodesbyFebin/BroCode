import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { MemoryKind } from "@/lib/agent/types";
import { useSession, useWork } from "@/lib/store";
import { relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KINDS: MemoryKind[] = ["fact", "preference", "decision", "pattern"];

export function MemoryPanel() {
  const memories = useSession().memories;
  const addMemory = useWork((s) => s.addMemory);
  const deleteMemory = useWork((s) => s.deleteMemory);
  const [kind, setKind] = useState<MemoryKind>("fact");
  const [content, setContent] = useState("");

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Persistent memory
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Recalled on every turn. Survives reloads on this device.
        </p>
      </div>
      <form
        className="space-y-2 px-3 pb-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!content.trim()) return;
          addMemory({ kind, content: content.trim(), tags: [kind] });
          setContent("");
        }}
      >
        <div className="flex gap-1">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                kind === k
                  ? "h-8 rounded-sm bg-secondary px-2 text-xs text-primary"
                  : "h-8 rounded-sm px-2 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {k}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Remember that…"
          />
          <Button type="submit" size="icon" aria-label="Store memory">
            <Plus className="size-4" />
          </Button>
        </div>
      </form>
      <div className="code-scroll min-h-0 flex-1 space-y-2 overflow-auto px-3 pb-4">
        {memories.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No memories yet.</p>
        ) : (
          [...memories].reverse().map((m) => (
            <article key={m.id} className="rounded-md bg-secondary p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs uppercase tracking-wider text-primary">{m.kind}</span>
                <button
                  type="button"
                  aria-label="Forget"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMemory(m.id)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-foreground">{m.content}</p>
              <p className="mt-2 text-xs text-muted-foreground">{relativeTime(m.createdAt)}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
