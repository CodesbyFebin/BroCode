import { AGENTS } from "./providers";
import type { AgentRole, SwarmAgent, SwarmState } from "./types";

export function idleSwarm(): SwarmState {
  return {
    running: false,
    agents: AGENTS.map((a) => ({
      id: a.id,
      status: "idle",
      thought: "",
      output: "",
    })),
  };
}

export function queuedSwarm(): SwarmState {
  return {
    running: true,
    startedAt: Date.now(),
    agents: AGENTS.map((a, i) => ({
      id: a.id,
      status: i === 0 ? "thinking" : "queued",
      thought: "",
      output: "",
      startedAt: i === 0 ? Date.now() : undefined,
    })),
  };
}

export function advanceSwarm(agents: SwarmAgent[], tick: number): SwarmAgent[] {
  const order: AgentRole[] = AGENTS.map((a) => a.id);
  const activeIndex = Math.min(tick, order.length - 1);
  return agents.map((agent) => {
    const idx = order.indexOf(agent.id);
    if (idx < activeIndex) {
      return agent.status === "done"
        ? agent
        : { ...agent, status: "thinking" };
    }
    if (idx === activeIndex) {
      return {
        ...agent,
        status: "thinking",
        startedAt: agent.startedAt ?? Date.now(),
      };
    }
    return agent.status === "idle" ? { ...agent, status: "queued" } : agent;
  });
}
