import type { AgentRole, FileAction, FileChange, MemoryKind, SwarmPayload } from "./types";

const ROLES: AgentRole[] = [
  "orchestrator",
  "planner",
  "architect",
  "implementer",
  "reviewer",
  "tester",
  "researcher",
  "security",
  "compliance",
  "pipeline",
  "greenops",
];

const ACTIONS: FileAction[] = ["create", "update", "delete"];
const KINDS: MemoryKind[] = ["fact", "preference", "decision", "pattern"];

export function parseSwarmPayload(raw: string): SwarmPayload {
  const json = extractJson(raw);
  if (!json || typeof json !== "object") {
    return { summary: raw.trim() || "No response.", files: [], agents: [], memories: [] };
  }
  const o = json as Record<string, unknown>;
  const summary = str(o.summary) || str(o.message) || str(o.reply) || "Done.";
  const title = str(o.title) || undefined;

  const agents: NonNullable<SwarmPayload["agents"]> = [];
  for (const item of asArray(o.agents)) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const id = str(a.id) as AgentRole;
    if (!ROLES.includes(id)) continue;
    agents.push({ id, thought: str(a.thought), output: str(a.output) });
  }

  const files: FileChange[] = [];
  for (const item of asArray(o.files)) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const path = str(f.path);
    const action = (str(f.action) || "update") as FileAction;
    if (!path || !ACTIONS.includes(action)) continue;
    const content = str(f.content);
    files.push({ path, action, content: content || undefined });
  }

  const memories: NonNullable<SwarmPayload["memories"]> = [];
  for (const item of asArray(o.memories)) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const content = str(m.content);
    const kind = (str(m.kind) || "fact") as MemoryKind;
    if (!content || !KINDS.includes(kind)) continue;
    const tags = asArray(m.tags).map((t) => String(t)).filter(Boolean);
    memories.push({ kind, content, tags });
  }

  return { title, summary, agents, files, memories };
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function str(v: unknown) {
  return typeof v === "string" ? v : "";
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
