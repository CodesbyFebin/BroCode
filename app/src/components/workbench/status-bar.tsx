import { BUILT_WITH_LLAMA, isLlamaProvider } from "@/lib/agent/llama";
import { modelAttribution } from "@/lib/agent/openweights";
import { fallbackRoute, modelLabel } from "@/lib/agent/providers";
import { useSession, useWork } from "@/lib/store";

export function StatusBar() {
  const session = useSession();
  const settings = useWork((s) => s.settings);
  const xai = useWork((s) => s.xaiReady);
  const route = fallbackRoute(settings);
  const fileCount = Object.keys(session.files).length;
  const mem = session.memories.length;
  const running = session.swarm.running;

  return (
    <footer className="hidden h-8 items-center justify-between gap-4 border-t border-border bg-sidebar px-3 text-xs text-muted-foreground md:flex">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={
              running
                ? "size-1.5 rounded-full bg-primary"
                : xai === false
                  ? "size-1.5 rounded-full bg-warn"
                  : "size-1.5 rounded-full bg-primary"
            }
          />
          {running ? "Swarm live" : xai === false ? "Add a gateway key" : "Gateway ready"}
        </span>
        <span className="text-border">/</span>
        <span className="truncate font-mono">
          {modelLabel(route.providerId, route.model)} · {settings.strategy}{isLlamaProvider(route.providerId) || modelAttribution(route.providerId, route.model) ? ` · ${BUILT_WITH_LLAMA}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-3 tabular-nums">
        <span>{fileCount} files</span>
        <span>{mem} memories</span>
        <span>{session.messages.length} turns</span>
        <span className="text-primary">codingagent.in</span>
      </div>
    </footer>
  );
}
