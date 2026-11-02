export type Commit = { sha: string; message: string; author?: string; pr?: number | null };

const TYPES: [string, string][] = [
  ["feat", "✨ Features"], ["fix", "🐛 Fixes"], ["perf", "⚡ Performance"], ["security", "🔒 Security"], ["refactor", "♻️ Refactors"],
  ["docs", "📝 Docs"], ["test", "✅ Tests"], ["ci", "🔧 CI / build"], ["build", "🔧 CI / build"], ["chore", "🧹 Chores"],
];

export function parseCommit(c: Commit) {
  const subject = c.message.split("\n")[0].trim();
  const m = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(subject);
  const breaking = !!m?.[3] || /BREAKING CHANGE:/.test(c.message);
  const prM = /\(#(\d+)\)\s*$/.exec(subject)?.[1] ?? /^Merge pull request #(\d+)/.exec(subject)?.[1];
  const pr = c.pr ?? (prM ? Number(prM) : null);
  let type = m ? m[1].toLowerCase() : "other";
  if (!TYPES.some(([t]) => t === type)) type = /\b(fix|bug|patch)\b/i.test(subject) ? "fix" : /\b(add|new|feat|introduce)\b/i.test(subject) ? "feat" : "other";
  return { type, scope: m?.[2] ?? null, breaking, subject: (m ? m[4] : subject).replace(/\s*\(#\d+\)\s*$/, ""), pr, sha: c.sha.slice(0, 7) };
}

/** Grouped markdown release notes from merged commits (Conventional Commits aware). */
export function releaseNotes(commits: Commit[], opts: { title?: string; repoUrl?: string } = {}): string {
  const parsed = commits.filter((c) => !/^Merge (branch|remote-tracking)/.test(c.message)).map(parseCommit);
  const link = (p: ReturnType<typeof parseCommit>) => (p.pr ? (opts.repoUrl ? ` ([#${p.pr}](${opts.repoUrl}/pull/${p.pr}))` : ` (#${p.pr})`) : ` (${p.sha})`);
  const line = (p: ReturnType<typeof parseCommit>) => `- ${p.scope ? `**${p.scope}:** ` : ""}${p.subject}${link(p)}`;
  const out = [`## ${opts.title ?? "Release notes"}`, ""];
  const breaking = parsed.filter((p) => p.breaking);
  if (breaking.length) out.push("### ⚠️ Breaking changes", ...breaking.map(line), "");
  const groups = new Map<string, string[]>();
  for (const p of parsed) {
    const h = TYPES.find(([t]) => t === p.type)?.[1] ?? "Other changes";
    groups.set(h, [...(groups.get(h) ?? []), line(p)]);
  }
  for (const [, h] of [...TYPES, ["other", "Other changes"]]) if (groups.has(h)) { out.push(`### ${h}`, ...groups.get(h)!, ""); groups.delete(h); }
  out.push(`_${parsed.length} commits._`);
  return out.join("\n");
}
