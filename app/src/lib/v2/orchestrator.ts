// Multi-agent orchestrator: planner -> coder -> tester -> reviewer, looping on failures. LLM and exec are injected.
export type Role = "planner" | "coder" | "reviewer" | "tester";
export const ROLE_TIER: Record<Role, "nano" | "super" | "ultra"> = { planner: "ultra", coder: "super", reviewer: "ultra", tester: "nano" };
export type OrchDeps = {
  llm: (role: Role, tier: "nano" | "super" | "ultra", prompt: string) => Promise<string>;
  exec: (files: Record<string, string>, command: string) => Promise<{ exitCode: number; output: string }>;
};
export type OrchEvent = { round: number; role: Role; summary: string };
export type OrchResult = { ok: boolean; rounds: number; plan: string; files: Record<string, string>; events: OrchEvent[]; reason: string };

/** Coder must reply with fenced blocks: ```file:path\n...\n``` */
export function parseFiles(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/```file:([^\n`]+)\n([\s\S]*?)```/g)) {
    const p = m[1].trim();
    if (p.startsWith("/") || p.split("/").includes("..")) throw new Error(`unsafe path ${p}`);
    out[p] = m[2];
  }
  return out;
}

export async function orchestrate(task: string, files: Record<string, string>, testCmd: string, deps: OrchDeps, maxRounds = 3): Promise<OrchResult> {
  const events: OrchEvent[] = [];
  const work = { ...files };
  const plan = await deps.llm("planner", ROLE_TIER.planner, `Plan the change as numbered steps.\nTask: ${task}\nFiles: ${Object.keys(work).join(", ")}`);
  events.push({ round: 0, role: "planner", summary: plan.slice(0, 200) });
  let feedback = "";
  for (let round = 1; round <= maxRounds; round++) {
    const code = await deps.llm("coder", ROLE_TIER.coder, `Task: ${task}\nPlan:\n${plan}\n${feedback ? `Fix this feedback:\n${feedback}\n` : ""}Current files:\n${Object.entries(work).map(([p, c]) => `--- ${p}\n${c}`).join("\n")}\nReply with \`\`\`file:path blocks.`);
    const changed = parseFiles(code);
    Object.assign(work, changed);
    events.push({ round, role: "coder", summary: `changed ${Object.keys(changed).join(", ") || "nothing"}` });
    const t = await deps.exec(work, testCmd);
    events.push({ round, role: "tester", summary: `exit ${t.exitCode}` });
    if (t.exitCode !== 0) { feedback = `Tests failed:\n${t.output.slice(-4000)}`; continue; }
    const review = await deps.llm("reviewer", ROLE_TIER.reviewer, `Review for correctness and security. Reply APPROVE or CHANGES: <reasons>.\nTask: ${task}\n${Object.entries(changed).map(([p, c]) => `--- ${p}\n${c}`).join("\n")}`);
    const approved = /^\s*APPROVE/i.test(review);
    events.push({ round, role: "reviewer", summary: approved ? "approved" : review.slice(0, 200) });
    if (approved) return { ok: true, rounds: round, plan, files: work, events, reason: "tests pass and reviewer approved" };
    feedback = review;
  }
  return { ok: false, rounds: maxRounds, plan, files: work, events, reason: "round limit reached" };
}
