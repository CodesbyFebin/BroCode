/**
 * Implement-then-review handoff scheduler (our own code).
 * Data shapes come from the vendored Ensemble collaboration schema; the
 * "implement and review" role pattern is Ensemble's template idea.
 */
import {
  collaborationParticipantSchema,
  type CollaborationParticipant,
  type CollaborationTaskStatus,
} from "./vendor/ensemble-collaboration";

export interface HandoffTask {
  id: string;
  title: string;
  participantId: string;
  prompt: string;
  dependsOn: string[];
  status: CollaborationTaskStatus;
  result?: string;
  attempts: number;
}
export type Verdict = "approve" | "changes";
export interface StepCtx {
  participant: CollaborationParticipant;
  task: HandoffTask;
  /** Results of the tasks this one depends on, by id. */
  upstream: Record<string, string>;
  readOnly: boolean;
}
export type Act = (ctx: StepCtx) => Promise<string>;

export function participant(id: string, role: "implementer" | "reviewer", extra: Partial<CollaborationParticipant> = {}): CollaborationParticipant {
  return collaborationParticipantSchema.parse({
    id, name: id, mode: "managed", roles: [role],
    permissions: {
      submitTasks: role === "implementer", sendMessages: true, configureRun: false, publishArtifacts: role === "implementer",
      workspace: { cwd: ".", access: role === "reviewer" ? "read-only" : "read-write" },
    },
    ...extra,
  });
}

/** Build the two-task implement → review plan. */
export function implementAndReview(goal: string, implementer = "builder", reviewer = "reviewer"): HandoffTask[] {
  return [
    { id: "implement", title: "Implement", participantId: implementer, prompt: goal, dependsOn: [], status: "pending", attempts: 0 },
    {
      id: "review", title: "Review", participantId: reviewer, dependsOn: ["implement"], status: "pending", attempts: 0,
      prompt: `Review the change for: ${goal}\nReply with a first line of APPROVE or REQUEST_CHANGES, then reasons.`,
    },
  ];
}

export function parseVerdict(text: string): Verdict {
  const first = text.trim().split("\n")[0]?.toUpperCase() ?? "";
  return first.includes("APPROVE") && !first.includes("REQUEST_CHANGES") ? "approve" : "changes";
}

/** Tasks whose dependencies are all completed. */
export function ready(tasks: HandoffTask[]): HandoffTask[] {
  const done = new Set(tasks.filter((t) => t.status === "completed").map((t) => t.id));
  return tasks.filter((t) => t.status === "pending" && t.dependsOn.every((d) => done.has(d)));
}

export interface HandoffResult {
  status: "completed" | "failed";
  tasks: HandoffTask[];
  log: { task: string; participant: string; attempt: number; output: string }[];
  rounds: number;
}

/**
 * Run tasks in dependency order. A reviewer that requests changes sends the
 * implement task back (with the review as feedback) until it approves or
 * `maxRounds` is exhausted. Reviewers always run read-only.
 */
export async function runHandoff(
  participants: CollaborationParticipant[],
  initial: HandoffTask[],
  act: Act,
  opts: { maxRounds?: number; maxSteps?: number } = {},
): Promise<HandoffResult> {
  const maxRounds = opts.maxRounds ?? 3;
  const maxSteps = opts.maxSteps ?? 50;
  const byId = new Map(participants.map((p) => [p.id, p]));
  const tasks = initial.map((t) => ({ ...t, dependsOn: [...t.dependsOn] }));
  for (const t of tasks) if (!byId.has(t.participantId)) throw new Error(`unknown participant ${t.participantId}`);
  const log: HandoffResult["log"] = [];
  let rounds = 1;
  for (let step = 0; step < maxSteps; step++) {
    const next = ready(tasks)[0];
    if (!next) break;
    const p = byId.get(next.participantId)!;
    const readOnly = p.roles.includes("reviewer") || p.permissions.workspace?.access === "read-only";
    const upstream = Object.fromEntries(tasks.filter((t) => next.dependsOn.includes(t.id)).map((t) => [t.id, t.result ?? ""]));
    next.status = "running";
    next.attempts++;
    let out: string;
    try {
      out = await act({ participant: p, task: next, upstream, readOnly });
    } catch (e) {
      next.status = "failed";
      next.result = (e as Error).message;
      log.push({ task: next.id, participant: p.id, attempt: next.attempts, output: `error: ${next.result}` });
      return { status: "failed", tasks, log, rounds };
    }
    next.result = out;
    next.status = "completed";
    log.push({ task: next.id, participant: p.id, attempt: next.attempts, output: out });
    if (p.roles.includes("reviewer") && parseVerdict(out) === "changes") {
      if (rounds >= maxRounds) {
        next.status = "failed";
        return { status: "failed", tasks, log, rounds };
      }
      rounds++;
      for (const dep of next.dependsOn) {
        const d = tasks.find((t) => t.id === dep)!;
        d.status = "pending";
        d.prompt = `${initial.find((t) => t.id === dep)?.prompt ?? d.prompt}\n\nReviewer feedback:\n${out}`;
      }
      next.status = "pending";
    }
  }
  const ok = tasks.every((t) => t.status === "completed");
  return { status: ok ? "completed" : "failed", tasks, log, rounds };
}
