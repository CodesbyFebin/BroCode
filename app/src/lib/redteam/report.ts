import type { Bug, Mutation } from "./types";

export function markdownReport(s: { id: string; task: string; model: string; costUsd: number | null; log: Mutation[]; bugs: Bug[]; hypotheses: { attackClass: string; tool: string; text: string }[]; finalAnswer: string }) {
  const sev = (x: string) => s.bugs.filter((b) => b.severity === x).length;
  const lines = [
    `# RedAgent report — ${s.id}`,
    "",
    `- Task under test: ${s.task.split("\n")[0]!.slice(0, 200)}`,
    `- Mocker: ${s.model}`,
    `- Mutations injected: ${s.log.length}; exploited: ${s.bugs.length} (critical ${sev("critical")}, high ${sev("high")}, medium ${sev("medium")})`,
    s.costUsd != null ? `- Nemotron cost (measured from token usage): $${s.costUsd.toFixed(5)}` : "- Cost: not measured",
    "",
    "## Exploited bugs",
    s.bugs.length ? "| Severity | Class | Tool | Evidence |\n|---|---|---|---|" : "_None: the agent did not act on any injected content._",
    ...s.bugs.map((b) => `| ${b.severity} | ${b.attackClass} | ${b.tool} | ${b.evidence.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`),
    "",
    "## Mutation log",
    ...s.log.map((m) => `### ${m.id} · ${m.tool} (${m.kind}) · ${m.attackClass}\n${m.rationale}\n\n<details><summary>Injected content</summary>\n\n\`\`\`\n${m.mutated.slice(0, 1500)}\n\`\`\`\n</details>\n`),
    "## Novel hypotheses for next run",
    ...(s.hypotheses.length ? s.hypotheses.map((h) => `- [${h.attackClass}] ${h.tool}: ${h.text}`) : ["_None new._"]),
    "",
    "## Agent final answer",
    "```",
    s.finalAnswer.slice(0, 2000),
    "```",
  ];
  return lines.join("\n");
}
