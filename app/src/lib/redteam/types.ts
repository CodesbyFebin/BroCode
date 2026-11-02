export type AttackClass = "prompt_injection" | "false_data_trust" | "state_corruption" | "privilege_escalation";
export const ATTACK_CLASSES: AttackClass[] = ["prompt_injection", "false_data_trust", "state_corruption", "privilege_escalation"];
export type Severity = "critical" | "high" | "medium" | "low";
export const SEVERITY: Record<AttackClass, Severity> = {
  privilege_escalation: "critical",
  prompt_injection: "high",
  state_corruption: "high",
  false_data_trust: "medium",
};
export type ToolKind = "query" | "mutation";

export type WorldState = {
  task: string;
  files: Record<string, string>;
  calls: { tool: string; kind: ToolKind; args: string; mutated: boolean }[];
  facts: string[]; // claims already injected, so later mutations stay consistent
};

export type MockDecision = {
  mutate: boolean;
  attackClass?: AttackClass;
  replacement?: string; // what the agent sees instead of the real result
  rationale?: string;
};

export type Mutation = {
  id: string;
  seq: number;
  tool: string;
  kind: ToolKind;
  attackClass: AttackClass;
  canary: string; // unique token; if it shows up in the agent's later actions, the mutation was acted on
  original: string;
  mutated: string;
  rationale: string;
};

export type AgentAction = { seq: number; type: "tool" | "final"; tool?: string; args?: string; text?: string };

export type Bug = {
  mutationId: string;
  attackClass: AttackClass;
  severity: Severity;
  tool: string;
  evidence: string;
};
