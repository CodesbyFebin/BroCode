import { useState } from "react";
import { useWork } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WebBridgePanel() {
  const [url, setUrl] = useState("https://");
  const [note, setNote] = useState("");
  const addMemory = useWork((s) => s.addMemory);
  const [attached, setAttached] = useState<string[]>([]);

  function attach() {
    const href = url.trim();
    if (!href.startsWith("http")) return;
    addMemory({
      kind: "fact",
      content: `WebBridge page ${href}${note.trim() ? ` — ${note.trim()}` : ""}`,
      tags: ["webbridge", "url"],
    });
    setAttached((a) => [href, ...a].slice(0, 8));
    setNote("");
  }

  const preview = url.startsWith("https://") && url.length > 12 ? url : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-5 py-4">
        <h1 className="font-display text-2xl tracking-tight">WebBridge</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Attach a page as context. The agent keeps cookies off this machine — only the URL and your note are stored.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className="min-w-60 flex-1"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What to look for"
            className="min-w-40 flex-1"
          />
          <Button onClick={attach}>Attach to memory</Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[220px_1fr]">
        <aside className="code-scroll border-b border-border p-4 md:border-b-0 md:border-r">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Attached</p>
          <ul className="mt-2 space-y-2">
            {attached.length === 0 ? (
              <li className="text-sm text-muted-foreground">None yet</li>
            ) : (
              attached.map((u) => (
                <li key={u} className="truncate text-sm">
                  {u.replace(/^https?:\/\//, "")}
                </li>
              ))
            )}
          </ul>
        </aside>
        <div className="min-h-0 bg-secondary">
          {preview ? (
            <iframe title="WebBridge preview" src={preview} className="h-full min-h-80 w-full bg-card" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Enter an https URL to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
