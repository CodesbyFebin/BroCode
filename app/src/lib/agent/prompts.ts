import { truncate } from "@/lib/utils";
import type { MemoryEntry, VFile, WorkMode } from "./types";

const MODE_RULES: Record<WorkMode, string> = {
  swarm:
    "Run a full swarm: planner, architect, researcher, implementer, reviewer, tester. Implement real file changes.",
  plan: "Produce a precise plan only. Do not emit file contents. files must be [].",
  chat: "Answer as a senior coding agent. Edit files only if the user asked for code changes.",
};

export function buildSystemPrompt(opts: {
  mode: WorkMode;
  files: Record<string, VFile>;
  memories: MemoryEntry[];
  openTabs: string[];
}) {
  const tree = Object.keys(opts.files).sort().join("\n");
  const recalled = opts.memories
    .slice()
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 12)
    .map((m) => `- [${m.kind}] ${m.content}`)
    .join("\n");

  const focus = pickFocusFiles(opts.files, opts.openTabs);
  const fileBlock = focus
    .map((f) => `### ${f.path}\n\`\`\`\n${truncate(f.content, 3500)}\n\`\`\``)
    .join("\n\n");

  return `You are BroCODE, a swarm coding workbench (Kimi Work / Cline / Antigravity class).
You edit a virtual workspace. Never invent tools you do not have. Return JSON only.

Mode: ${opts.mode}
${MODE_RULES[opts.mode]}

Workspace tree:
${tree || "(empty)"}

Persistent memory:
${recalled || "(none yet)"}

Focused files:
${fileBlock || "(none)"}

Return a single JSON object, no markdown fences:
{
  "title": "short session title",
  "summary": "markdown for the user: what you did, why, next step",
  "agents": [
    { "id": "planner", "thought": "one beat", "output": "result" }
  ],
  "files": [
    { "path": "src/store.ts", "action": "update", "content": "full file contents" }
  ],
  "memories": [
    { "kind": "decision", "content": "durable fact", "tags": ["api"] }
  ]
}

Rules:
- Agent ids must be one of: orchestrator, planner, architect, researcher, implementer, reviewer, tester.
- File paths are workspace-relative. Always send FULL file content on create/update.
- Keep code compiling. Prefer TypeScript. No placeholders like TODO unless asked.
- Memories are durable facts, decisions, preferences, or patterns — not chatter.
- In plan mode, files must be [].`;
}

function pickFocusFiles(files: Record<string, VFile>, openTabs: string[]) {
  const paths = new Set<string>(openTabs);
  const keys = Object.keys(files);
  for (const k of keys) {
    if (paths.size >= 8) break;
    if (k.startsWith("src/") || k.endsWith(".md")) paths.add(k);
  }
  return [...paths]
    .map((p) => files[p])
    .filter((f): f is VFile => Boolean(f))
    .slice(0, 8);
}

export function maxTokensFor(mode: WorkMode) {
  if (mode === "swarm") return 2500;
  if (mode === "plan") return 900;
  return 1200;
}
