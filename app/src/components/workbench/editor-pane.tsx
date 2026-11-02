import { Undo2, X } from "lucide-react";
import { useRef } from "react";
import { useSession, useWork } from "@/lib/store";
import { extOf, fileName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EditorPane() {
  const session = useSession();
  const setActiveTab = useWork((s) => s.setActiveTab);
  const closeTab = useWork((s) => s.closeTab);
  const upsertFile = useWork((s) => s.upsertFile);
  const undoFiles = useWork((s) => s.undoFiles);
  const gutterRef = useRef<HTMLDivElement>(null);
  const file = session.activeTab ? session.files[session.activeTab] : undefined;
  const lines = file ? file.content.split("\n") : [];

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="flex h-10 items-center gap-1 overflow-x-auto border-b border-border bg-sidebar px-1">
        {session.openTabs.length === 0 ? (
          <span className="px-3 text-xs text-muted-foreground">No files open</span>
        ) : (
          session.openTabs.map((tab) => (
            <div
              key={tab}
              className={cn(
                "group flex h-8 shrink-0 items-center rounded-sm pl-2",
                session.activeTab === tab ? "bg-secondary text-foreground" : "text-muted-foreground",
              )}
            >
              <button
                type="button"
                className="max-w-40 truncate px-1 text-xs"
                onClick={() => setActiveTab(tab)}
              >
                {fileName(tab)}
              </button>
              <button
                type="button"
                aria-label={`Close ${tab}`}
                className="size-7 text-muted-foreground opacity-70 hover:text-foreground"
                onClick={() => closeTab(tab)}
              >
                <X className="mx-auto size-3" />
              </button>
            </div>
          ))
        )}
        <div className="ml-auto pr-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={session.snapshots.length === 0}
            onClick={() => undoFiles()}
          >
            <Undo2 className="size-3.5" />
            Undo
          </Button>
        </div>
      </div>
      {file ? (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            ref={gutterRef}
            aria-hidden
            className="code-scroll w-10 shrink-0 overflow-hidden bg-gutter py-3 text-right font-mono text-xs leading-6 text-muted-foreground select-none"
          >
            {lines.map((_, i) => (
              <div key={i} className="px-2">
                {i + 1}
              </div>
            ))}
          </div>
          <textarea
            key={file.path}
            spellCheck={false}
            value={file.content}
            onChange={(e) => upsertFile(file.path, e.target.value)}
            onScroll={(e) => {
              if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
            }}
            className="code-scroll min-h-0 flex-1 resize-none bg-background py-3 pr-4 pl-3 font-mono text-sm leading-6 text-foreground focus-visible:outline-none"
            aria-label={file.path}
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Open a file from the workspace.
        </div>
      )}
      {file ? (
        <div className="flex h-8 items-center justify-between border-t border-border px-3 text-xs text-muted-foreground">
          <span className="truncate font-mono">{file.path}</span>
          <span className="uppercase">{extOf(file.path) || "text"}</span>
        </div>
      ) : null}
    </section>
  );
}
