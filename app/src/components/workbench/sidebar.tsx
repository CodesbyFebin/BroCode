import { useWork } from "@/lib/store";
import { CronPanel } from "./cron-panel";
import { Dashboard } from "./dashboard";
import { FileTree } from "./file-tree";
import { GatewayPanel } from "./gateway-panel";
import { MemoryPanel } from "./memory-panel";
import { SkillsPanel } from "./skills-panel";
import { NewTaskHome } from "./start-overlay";
import { WebBridgePanel } from "./webbridge-panel";
import { PipelinePanel } from "./pipeline-panel";
import { MeridianPanel } from "./meridian-panel";
import { WorkflowPanel } from "./workflow-panel";
import { BoardPanel } from "./board-panel";
import { WhispererPanel } from "./whisperer-panel";
import { RedTeamPanel } from "./redteam-panel";

export function Sidebar() {
  const activity = useWork((s) => s.activity);
  return (
    <aside className="h-full min-h-0 w-full overflow-hidden bg-sidebar">
      {activity === "home" ? <NewTaskHome /> : null}
      {activity === "files" ? <FileTree /> : null}
      {activity === "dashboard" ? <Dashboard /> : null}
      {activity === "memory" ? <MemoryPanel /> : null}
      {activity === "plugins" ? <GatewayPanel /> : null}
      {activity === "skills" ? <SkillsPanel /> : null}
      {activity === "cron" ? <CronPanel /> : null}
      {activity === "webbridge" ? <WebBridgePanel /> : null}
      {activity === "pipeline" ? <PipelinePanel /> : null}
      {activity === "redteam" ? <RedTeamPanel /> : null}
      {activity === "meridian" ? <MeridianPanel /> : null}
      {activity === "whisperer" ? <WhispererPanel /> : null}
      {activity === "workflows" ? <WorkflowPanel /> : null}
      {activity === "board" ? <BoardPanel /> : null}
    </aside>
  );
}
