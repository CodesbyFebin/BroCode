import { AGENTS } from "@/lib/agent/providers";
import type { AgentStatus, SwarmAgent } from "@/lib/agent/types";
import { useSession } from "@/lib/store";
import { cn } from "@/lib/utils";

const POS: Record<string, { x: number; y: number }> = {
  orchestrator: { x: 160, y: 28 },
  planner: { x: 48, y: 88 },
  architect: { x: 160, y: 88 },
  researcher: { x: 272, y: 88 },
  implementer: { x: 160, y: 148 },
  reviewer: { x: 88, y: 208 },
  tester: { x: 232, y: 208 },
  security: { x: 40, y: 268 },
  compliance: { x: 120, y: 268 },
  pipeline: { x: 200, y: 268 },
  greenops: { x: 280, y: 268 },
};

const EDGES: [string, string][] = [
  ["orchestrator", "planner"],
  ["orchestrator", "architect"],
  ["orchestrator", "researcher"],
  ["planner", "implementer"],
  ["architect", "implementer"],
  ["researcher", "implementer"],
  ["implementer", "reviewer"],
  ["implementer", "tester"],
  ["reviewer", "security"],
  ["reviewer", "compliance"],
  ["tester", "pipeline"],
  ["tester", "greenops"],
];

function tone(status: AgentStatus) {
  if (status === "thinking") return "text-primary";
  if (status === "done") return "text-foreground";
  if (status === "error") return "text-destructive";
  return "text-muted-foreground";
}

export function SwarmConstellation({ agents }: { agents: SwarmAgent[] }) {
  const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
  return (
    <svg viewBox="0 0 320 300" className="w-full text-border" role="img" aria-label="Agent swarm">
      {EDGES.map(([a, b]) => {
        const pa = POS[a]!;
        const pb = POS[b]!;
        const live =
          byId[a]?.status === "thinking" ||
          byId[b]?.status === "thinking" ||
          byId[a]?.status === "done";
        return (
          <line
            key={`${a}-${b}`}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke={live ? "var(--color-primary)" : "currentColor"}
            strokeOpacity={live ? 0.55 : 0.35}
            strokeWidth="1"
          />
        );
      })}
      {AGENTS.map((def) => {
        const p = POS[def.id]!;
        const agent = byId[def.id];
        const status = agent?.status ?? "idle";
        const active = status === "thinking";
        return (
          <g key={def.id} transform={`translate(${p.x},${p.y})`}>
            {active ? (
              <circle r="16" fill="none" stroke="var(--color-primary)" className="agent-pulse" />
            ) : null}
            <circle
              r="11"
              fill="var(--color-card)"
              stroke={active || status === "done" ? "var(--color-primary)" : "currentColor"}
              strokeWidth="1.25"
            />
            <text
              y="28"
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize="8"
              fontFamily="var(--font-sans)"
            >
              {def.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function SwarmPanel() {
  const swarm = useSession().swarm;
  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-3">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Swarm
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {swarm.running ? "Agents are coordinating on this job." : "Idle — send a job from Work."}
        </p>
      </div>
      <div className="px-2">
        <SwarmConstellation agents={swarm.agents} />
      </div>
      <div className="code-scroll min-h-0 flex-1 space-y-2 overflow-auto px-3 pb-4">
        {swarm.agents.map((a) => (
          <article key={a.id} className="rounded-md bg-secondary p-3">
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-sm capitalize", tone(a.status))}>{a.id}</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {a.status}
              </span>
            </div>
            {a.thought || a.output ? (
              <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                {a.thought || a.output}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
