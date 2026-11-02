export type AgentRole =
  | "orchestrator"
  | "planner"
  | "architect"
  | "implementer"
  | "reviewer"
  | "tester"
  | "researcher"
  | "security"
  | "compliance"
  | "pipeline"
  | "greenops";

export type WorkMode = "chat" | "plan" | "swarm";
export type AppMode = "work" | "chat";
export type PermissionMode = "default" | "manual" | "auto";
export type CronCadence = "hourly" | "daily" | "weekly";

export type RouteStrategy = "auto" | "quality" | "fast" | "free";

export type MemoryKind = "fact" | "preference" | "decision" | "pattern";

export type AgentStatus = "idle" | "queued" | "thinking" | "done" | "error";

export type FileAction = "create" | "update" | "delete";

export type VFile = {
  path: string;
  content: string;
  updatedAt: number;
};

export type FileChange = {
  path: string;
  action: FileAction;
  content?: string;
};

export type MemoryEntry = {
  id: string;
  kind: MemoryKind;
  content: string;
  tags: string[];
  createdAt: number;
  strength: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  agentId?: AgentRole;
  artifacts?: FileChange[];
  routed?: { providerId: string; model: string };
  /** Per-step model + cost trace (Nemotron tier routing). */
  trace?: TraceStep[];
  review?: string;
  citations?: { title: string; url: string; snippet: string }[];
  verification?: VerificationResult;
};

export type TraceStep = {
  label: string;
  model: string;
  costUsd: number;
  tokens: number;
  ms: number;
};

export type VerificationResult = {
  command: string | null;
  passed: boolean;
  attempts: number;
  costUsd: number;
  changed: string[];
  steps: (
    | { kind: "run"; attempt: number; command: string; exitCode: number; output: string; ms: number; runner: string }
    | { kind: "repair"; attempt: number; model: string; note: string; paths: string[]; costUsd: number; tokens: number }
    | { kind: "error"; attempt: number; message: string }
  )[];
};

export type SwarmAgent = {
  id: AgentRole;
  status: AgentStatus;
  thought: string;
  output: string;
  model?: string;
  startedAt?: number;
  finishedAt?: number;
};

export type SwarmState = {
  running: boolean;
  startedAt?: number;
  finishedAt?: number;
  agents: SwarmAgent[];
};

export type CronJob = {
  id: string;
  title: string;
  prompt: string;
  cadence: CronCadence;
  enabled: boolean;
  lastRunAt?: number;
};

export type WorkSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  files: Record<string, VFile>;
  openTabs: string[];
  activeTab: string | null;
  memories: MemoryEntry[];
  swarm: SwarmState;
  snapshots: { at: number; files: Record<string, VFile> }[];
  pending: FileChange[];
};

export type RoleRoute = {
  providerId: string;
  model: string;
};

export type SettingsState = {
  strategy: RouteStrategy;
  mode: WorkMode;
  keys: Record<string, string>;
  roleRouting: Partial<Record<AgentRole, RoleRoute>>;
  defaultProviderId: string;
  defaultModel: string;
  permission: PermissionMode;
};

export type ProviderModel = {
  id: string;
  label: string;
  free: boolean;
  speed: "fast" | "medium" | "quality";
  roles: AgentRole[];
  /** SPDX-ish license name of the open weights (see README "Open-weight models"). */
  license?: string;
  /** false = id seen in provider docs but not confirmed as a live serverless chat model. */
  verified?: boolean;
  /** Per-model attribution, e.g. "Built with Llama" for Llama-licensed weights. */
  attribution?: string;
};

export type ProviderDef = {
  id: string;
  name: string;
  baseUrl: string;
  builtIn?: boolean;
  /** Selectable only: never chosen by automatic routing or as a fallback. */
  optIn?: boolean;
  attribution?: string;
  docs: string;
  keyHint: string;
  models: ProviderModel[];
};

export type GatewayRequest = {
  mode: WorkMode;
  providerId: string;
  model: string;
  baseUrl: string;
  apiKey?: string;
  system: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  maxTokens: number;
};

export type GatewayResponse =
  | { ok: true; text: string; model: string; providerId: string; costUsd?: number; tokens?: number; ms?: number; attribution?: string }
  | { ok: false; error: string };

export type SwarmPayload = {
  title?: string;
  summary: string;
  agents?: {
    id: AgentRole;
    thought?: string;
    output?: string;
  }[];
  files?: FileChange[];
  memories?: { kind: MemoryKind; content: string; tags?: string[] }[];
};

export type ActivityId =
  | "home"
  | "dashboard"
  | "plugins"
  | "skills"
  | "cron"
  | "webbridge"
  | "files"
  | "memory"
  | "pipeline"
  | "redteam"
  | "meridian"
  | "whisperer"
  | "workflows"
  | "board";

export type MobileTab = "home" | "task" | "files" | "more";
