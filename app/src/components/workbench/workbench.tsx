import { PipelinePanel } from "./pipeline-panel";
import { MeridianPanel } from "./meridian-panel";
import { WorkflowPanel } from "./workflow-panel";
import { BoardPanel } from "./board-panel";
import { WhispererPanel } from "./whisperer-panel";
import { RedTeamPanel } from "./redteam-panel";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from "react-resizable-panels";
import { getGatewayStatus } from "@/lib/agent/gateway";
import { runTurn } from "@/lib/agent/run";
import { useWork } from "@/lib/store";
import { ChatPane } from "./chat-pane";
import { CommandPalette } from "./command-palette";
import { CronPanel } from "./cron-panel";
import { Dashboard } from "./dashboard";
import { EditorPane } from "./editor-pane";
import { FileTree } from "./file-tree";
import { GatewayPanel } from "./gateway-panel";
import { MemoryPanel } from "./memory-panel";
import { MobileNav } from "./mobile-nav";
import { SkillsPanel } from "./skills-panel";
import { NewTaskHome } from "./start-overlay";
import { WebBridgePanel } from "./webbridge-panel";
import { WorkNav } from "./work-nav";
import { DEMO_PROMPT, createDemoSession } from "@/lib/agent/seed";

const CADENCE_MS = { hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 };

export function Workbench() {
  const setXaiReady = useWork((s) => s.setXaiReady);
  const mobileTab = useWork((s) => s.mobileTab);
  const activity = useWork((s) => s.activity);
  const appMode = useWork((s) => s.appMode);
  const [cmd, setCmd] = useState(false);

  useEffect(() => {
    void useWork.persist.rehydrate();
    void getGatewayStatus().then((s) => setXaiReady(s.nebius || s.xai));
    if (new URLSearchParams(window.location.search).has("demo")) {
      // Demo mode: seeded repo with a failing test + Nemotron tier routing.
      const demo = createDemoSession();
      useWork.setState((st) => ({
        sessions: [demo, ...st.sessions].slice(0, 24),
        currentId: demo.id,
        activity: "files",
        settings: { ...st.settings, defaultProviderId: "nebius", strategy: "auto", mode: "swarm", permission: "auto" },
      }));
      sessionStorage.setItem("codingagent:prefill", DEMO_PROMPT);
      window.dispatchEvent(new CustomEvent("codingagent:prefill", { detail: DEMO_PROMPT }));
    }
  }, [setXaiReady]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((v) => !v);
      }
      if (e.key === "Escape") setCmd(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const { cronJobs, patchCron, current } = useWork.getState();
      if (current().swarm.running) return;
      const now = Date.now();
      for (const job of cronJobs) {
        if (!job.enabled) continue;
        const span = CADENCE_MS[job.cadence];
        if (!job.lastRunAt || now - job.lastRunAt >= span) {
          patchCron(job.id, { lastRunAt: now });
          void runTurn(job.prompt);
          break;
        }
      }
    }, 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const desktopMain =
    appMode === "chat" ? (
      <ChatPane inputId="job-desktop-thread" />
    ) : activity === "home" ? (
      <NewTaskHome inputId="job-desktop" />
    ) : activity === "dashboard" ? (
      <Dashboard />
    ) : activity === "plugins" ? (
      <div className="flex h-full min-h-0 flex-col p-6">
        <h1 className="font-display text-3xl tracking-tight">Plugins</h1>
        <p className="mt-1 text-sm text-muted-foreground">Model gateway and provider keys.</p>
        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
          <GatewayPanel />
        </div>
      </div>
    ) : activity === "skills" ? (
      <SkillsPanel />
    ) : activity === "cron" ? (
      <CronPanel />
    ) : activity === "webbridge" ? (
      <WebBridgePanel />
    ) : activity === "pipeline" ? (
      <PipelinePanel />
    ) : activity === "redteam" ? (
      <RedTeamPanel />
    ) : activity === "meridian" ? (
      <MeridianPanel />
    ) : activity === "whisperer" ? (
      <WhispererPanel />
    ) : activity === "workflows" ? (
      <WorkflowPanel />
    ) : activity === "board" ? (
      <BoardPanel />
    ) : activity === "memory" ? (
      <div className="flex h-full min-h-0 flex-col p-6">
        <h1 className="font-display text-3xl tracking-tight">Memory</h1>
        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-lg bg-card shadow-[var(--shadow-border)]">
          <MemoryPanel />
        </div>
      </div>
    ) : (
      <PanelGroup orientation="horizontal" className="h-full w-full">
        <Panel defaultSize="34%" minSize="24%" className="min-h-0">
          <ChatPane inputId="job-files-thread" />
        </Panel>
        <PanelResizeHandle className="w-px bg-border" />
        <Panel defaultSize="18%" minSize="14%" maxSize="28%" className="min-h-0 bg-sidebar">
          <FileTree />
        </Panel>
        <PanelResizeHandle className="w-px bg-border" />
        <Panel defaultSize="48%" minSize="28%" className="min-h-0">
          <EditorPane />
        </Panel>
      </PanelGroup>
    );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div className="relative flex min-h-0 flex-1">
        <div className="hidden md:flex">
          <WorkNav />
        </div>
        <div className="hidden min-h-0 min-w-0 flex-1 md:flex">{desktopMain}</div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:hidden">
          {mobileTab === "home" ? <NewTaskHome inputId="job-mobile" /> : null}
          {mobileTab === "task" ? <ChatPane inputId="job-mobile-thread" /> : null}
          {mobileTab === "files" ? (
            <div className="flex min-h-0 flex-1">
              <div className="w-32 shrink-0 overflow-hidden border-r border-border">
                <FileTree />
              </div>
              <EditorPane />
            </div>
          ) : null}
          {mobileTab === "more" ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <Dashboard />
            </div>
          ) : null}
        </div>
      </div>
      <MobileNav />
      <CommandPalette open={cmd} onClose={() => setCmd(false)} />
      <Toaster
        theme="light"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "bg-card text-foreground border-border",
          },
        }}
      />
    </div>
  );
}
