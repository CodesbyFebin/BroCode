import { FileCode, FilePlus, Folder, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSession, useWork } from "@/lib/store";
import { fileName, parentDir } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function treeFrom(paths: string[]) {
  const dirs = new Map<string, string[]>();
  for (const path of paths) {
    const dir = parentDir(path) || ".";
    const list = dirs.get(dir) ?? [];
    list.push(path);
    dirs.set(dir, list);
  }
  return [...dirs.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function FileTree() {
  const session = useSession();
  const openTab = useWork((s) => s.openTab);
  const deleteFile = useWork((s) => s.deleteFile);
  const upsertFile = useWork((s) => s.upsertFile);
  const [creating, setCreating] = useState(false);
  const [path, setPath] = useState("");
  const paths = Object.keys(session.files).sort();
  const groups = treeFrom(paths);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <h2 className="text-xs font-medium text-muted-foreground">Files</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="New file"
          onClick={() => setCreating(true)}
        >
          <FilePlus className="size-4" />
        </Button>
      </div>
      {creating ? (
        <form
          className="px-3 pb-2"
          onSubmit={(e) => {
            e.preventDefault();
            const p = path.trim();
            if (p) upsertFile(p, "");
            setPath("");
            setCreating(false);
          }}
        >
          <Input
            autoFocus
            value={path}
            placeholder="src/new.ts"
            onChange={(e) => setPath(e.target.value)}
            onBlur={() => {
              if (!path.trim()) setCreating(false);
            }}
          />
        </form>
      ) : null}
      <div className="code-scroll min-h-0 flex-1 overflow-auto px-2 pb-4">
        {groups.map(([dir, files]) => (
          <div key={dir} className="mb-3">
            <div className="mb-1 flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <Folder className="size-3.5" />
              {dir === "." ? "root" : dir}
            </div>
            {files
              .sort()
              .map((p) => (
                <div key={p} className="group flex items-center">
                  <button
                    type="button"
                    onClick={() => openTab(p)}
                    className={cn(
                      "flex min-h-10 flex-1 items-center gap-2 rounded-sm px-2 text-left text-sm",
                      session.activeTab === p
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <FileCode className="size-3.5 shrink-0" />
                    <span className="truncate">{fileName(p)}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${p}`}
                    className="size-8 opacity-0 hover:text-destructive group-hover:opacity-100"
                    onClick={() => deleteFile(p)}
                  >
                    <Trash2 className="mx-auto size-3.5" />
                  </button>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
