import { uid } from "@/lib/utils";
import type { CronJob, MemoryEntry, VFile, WorkSession } from "./types";
import { idleSwarm } from "./swarm";

const SEED_AT = 1;

function file(path: string, content: string): VFile {
  return { path, content: content.replace(/^\n/, ""), updatedAt: SEED_AT };
}

export const STARTER_FILES: Record<string, VFile> = {
  "README.md": file(
    "README.md",
    `# Task Relay

In-memory TypeScript task API used as the default BroCODE workspace.

## Surface

- \`createTask\` / \`listTasks\` / \`completeTask\`
- Router in \`src/router.ts\`
- Tests in \`tests/tasks.test.ts\`

Ask the swarm to extend this: validation, persistence, auth, or a REST layer.
`,
  ),
  "package.json": file(
    "package.json",
    `{
  "name": "task-relay",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/index.ts",
    "test": "node --test tests/tasks.test.ts"
  }
}
`,
  ),
  "src/types.ts": file(
    "src/types.ts",
    `export type TaskStatus = "open" | "doing" | "done";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
  notes?: string;
};

export type TaskInput = {
  title: string;
  notes?: string;
};
`,
  ),
  "src/store.ts": file(
    "src/store.ts",
    `import type { Task, TaskInput } from "./types.ts";

const tasks = new Map<string, Task>();

export function createTask(input: TaskInput): Task {
  const title = input.title.trim();
  if (!title) throw new Error("title required");
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    status: "open",
    createdAt: Date.now(),
    notes: input.notes,
  };
  tasks.set(task.id, task);
  return task;
}

export function listTasks(): Task[] {
  return [...tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function completeTask(id: string): Task {
  const task = tasks.get(id);
  if (!task) throw new Error("not found");
  const next = { ...task, status: "done" as const };
  tasks.set(id, next);
  return next;
}
`,
  ),
  "src/router.ts": file(
    "src/router.ts",
    `import { completeTask, createTask, listTasks } from "./store.ts";
import type { Task, TaskInput } from "./types.ts";

export type RouteResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; status: number; error: string };

export function handle(method: string, path: string, body?: TaskInput): RouteResult {
  if (method === "GET" && path === "/tasks") {
    return { ok: true, status: 200, body: listTasks() };
  }
  if (method === "POST" && path === "/tasks") {
    if (!body) return { ok: false, status: 400, error: "body required" };
    const task: Task = createTask(body);
    return { ok: true, status: 201, body: task };
  }
  const done = path.match(/^\\/tasks\\/([^/]+)\\/complete$/);
  if (method === "POST" && done) {
    try {
      return { ok: true, status: 200, body: completeTask(done[1]!) };
    } catch {
      return { ok: false, status: 404, error: "not found" };
    }
  }
  return { ok: false, status: 404, error: "no route" };
}
`,
  ),
  "src/index.ts": file(
    "src/index.ts",
    `import { handle } from "./router.ts";

const demo = handle("POST", "/tasks", { title: "Ship the workbench" });
console.log(demo);
console.log(handle("GET", "/tasks"));
`,
  ),
  "tests/tasks.test.ts": file(
    "tests/tasks.test.ts",
    `import assert from "node:assert/strict";
    import test from "node:test";
    import { handle } from "../src/router.ts";

    test("creates and lists a task", () => {
      const created = handle("POST", "/tasks", { title: "Review diffs" });
      assert.equal(created.ok, true);
      const listed = handle("GET", "/tasks");
      assert.equal(listed.ok, true);
    });
`,
  ),
};

function seedMemories(pinned = false): MemoryEntry[] {
  const t = pinned ? SEED_AT : Date.now();
  const id = (k: string) => (pinned ? k : uid());
  return [
    {
      id: id("mem-stack"),
      kind: "fact",
      content: "Task Relay is a standard-library TypeScript module with an in-memory Map store.",
      tags: ["stack"],
      createdAt: t,
      strength: 0.9,
    },
    {
      id: id("mem-style"),
      kind: "preference",
      content: "Prefer small modules, explicit types, and tests beside the behavior they cover.",
      tags: ["style"],
      createdAt: t,
      strength: 0.8,
    },
    {
      id: id("mem-arch"),
      kind: "decision",
      content: "Stay on the standard library until the swarm chooses a framework.",
      tags: ["architecture"],
      createdAt: t,
      strength: 0.7,
    },
  ];
}

export function createSession(title = "Untitled work"): WorkSession {
  const t = Date.now();
  return {
    id: uid(),
    title,
    createdAt: t,
    updatedAt: t,
    messages: [],
    files: structuredClone(STARTER_FILES),
    openTabs: ["README.md", "src/store.ts", "src/router.ts"],
    activeTab: "src/store.ts",
    memories: seedMemories(),
    swarm: idleSwarm(),
    snapshots: [],
    pending: [],
  };
}

export function createInitialSession(): WorkSession {
  return {
    id: "session-task-relay",
    title: "Task Relay",
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
    messages: [],
    files: structuredClone(STARTER_FILES),
    openTabs: ["README.md", "src/store.ts", "src/router.ts"],
    activeTab: "src/store.ts",
    memories: seedMemories(true),
    swarm: idleSwarm(),
    snapshots: [],
    pending: [],
  };
}

export const SUGGESTED_JOBS = [
  {
    title: "Harden the API",
    prompt:
      "Add input validation, typed HTTP errors, and a PATCH /tasks/:id route to Task Relay. Update tests.",
  },
  {
    title: "Persistence layer",
    prompt:
      "Replace the in-memory Map with a pluggable persistence interface and a JSON file adapter. Keep the public API stable.",
  },
  {
    title: "Swarm orchestrator module",
    prompt:
      "Turn this codebase into a tiny multi-agent orchestrator: planner, implementer, reviewer. Include types and a demo run.",
  },
  {
    title: "Architecture note",
    prompt:
      "Write ADR-0001.md describing how Task Relay should grow into a coding-agent backend with memory and model routing.",
  },
];

export const WORK_SKILLS = [
  {
    id: "slides",
    name: "Slide deck",
    hint: "/slides",
    prompt:
      "Turn the current workspace into a concise slide outline (markdown) covering problem, approach, and next steps.",
  },
  {
    id: "report",
    name: "Research report",
    hint: "/report",
    prompt:
      "Write a research memo in markdown: context, findings, risks, and a recommended path. Use files already in the workspace.",
  },
  {
    id: "refactor",
    name: "Refactor",
    hint: "/refactor",
    prompt:
      "Refactor Task Relay for clarity: extract helpers, keep the public API stable, and update tests.",
  },
  {
    id: "tests",
    name: "Write tests",
    hint: "/tests",
    prompt:
      "Add focused tests for Task Relay edge cases: empty titles, double-complete, and missing ids.",
  },
  {
    id: "review",
    name: "Code review",
    hint: "/review",
    prompt:
      "Review the open files. List defects, missing tests, and a ranked patch plan. Apply the top fixes.",
  },
  {
    id: "docs",
    name: "Docs",
    hint: "/docs",
    prompt:
      "Rewrite README.md as operator docs: how to run, extend, and hand work to the swarm.",
  },
];

export const SAMPLE_CRON: CronJob[] = [
  {
    id: "cron-standup",
    title: "Morning standup note",
    prompt:
      "Write standup.md: what changed in Task Relay, open risks, and the next three jobs.",
    cadence: "daily",
    enabled: false,
  },
  {
    id: "cron-health",
    title: "Workspace health check",
    prompt:
      "Audit Task Relay for missing tests and stale comments. Patch what you find and summarize.",
    cadence: "weekly",
    enabled: false,
  },
];

/**
 * Demo repo for judges: a tiny slug/pricing utility with a real bug and a
 * failing test, so the write -> run -> test -> repair loop is visible end to end.
 * Plain ESM JS + node:test so it runs in any Node 18+ sandbox with zero installs.
 */
export const DEMO_PROMPT =
  "Add a `formatINR(paise)` helper to src/money.js that formats paise as Indian rupees (e.g. 12345678 -> '₹1,23,456.78') with tests, and make the whole test suite pass.";

export const DEMO_FILES: Record<string, VFile> = {
  "README.md": file(
    "README.md",
    `# demo-utils

Seeded demo workspace for BroCODE. \`npm test\` currently FAILS on purpose:
\`slugify\` does not collapse repeated separators. Ask the agent to add a feature
and watch it write code, run the tests in a sandbox, and repair failures with
Nemotron 3 Ultra.
`,
  ),
  "package.json": file(
    "package.json",
    `{
  "name": "demo-utils",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
`,
  ),
  "src/slug.js": file(
    "src/slug.js",
    `export function slugify(input) {
  return String(input)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "-");
}
`,
  ),
  "src/money.js": file(
    "src/money.js",
    `export function addPaise(a, b) {
  return a + b;
}
`,
  ),
  "tests/slug.test.js": file(
    "tests/slug.test.js",
    `import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slug.js";

test("slugify collapses separators and trims dashes", () => {
  assert.equal(slugify("  Hello,  World!  "), "hello-world");
  assert.equal(slugify("Nemotron 3 -- Ultra"), "nemotron-3-ultra");
});
`,
  ),
  "tests/money.test.js": file(
    "tests/money.test.js",
    `import { test } from "node:test";
import assert from "node:assert/strict";
import { addPaise } from "../src/money.js";

test("addPaise", () => {
  assert.equal(addPaise(100, 250), 350);
});
`,
  ),
};

export function createDemoSession(): WorkSession {
  const s = createSession("Demo · write → run → test → repair");
  return { ...s, files: structuredClone(DEMO_FILES), openTabs: ["src/slug.js"], activeTab: "src/slug.js" };
}
