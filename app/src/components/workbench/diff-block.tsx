import { lineDiff } from "@/lib/agent/diff";
import type { FileChange, VFile } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

export function DiffBlock({
  change,
  before,
}: {
  change: FileChange;
  before?: VFile;
}) {
  if (change.action === "delete") {
    return (
      <div className="overflow-hidden rounded-sm bg-secondary text-xs">
        <div className="border-b border-border px-3 py-2 font-mono text-destructive">
          deleted {change.path}
        </div>
      </div>
    );
  }
  const after = change.content ?? "";
  const lines = lineDiff(before?.content ?? "", after).slice(0, 80);
  return (
    <div className="overflow-hidden rounded-sm bg-gutter text-xs">
      <div className="border-b border-border px-3 py-2 font-mono text-muted-foreground">
        <span className="text-primary">{change.action}</span>{" "}
        <span className="text-foreground">{change.path}</span>
      </div>
      <pre className="code-scroll max-h-56 overflow-auto p-2 font-mono leading-5">
        {lines.map((l, i) => (
          <div
            key={`${i}-${l.kind}`}
            className={cn(
              "px-2",
              l.kind === "add" && "bg-primary/10 text-primary",
              l.kind === "del" && "bg-destructive/10 text-destructive",
              l.kind === "same" && "text-muted-foreground",
            )}
          >
            <span className="mr-3 inline-block w-3 opacity-70">
              {l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}
            </span>
            {l.text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}
