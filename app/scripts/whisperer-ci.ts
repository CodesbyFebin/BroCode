/**
 * CI Whisperer CLI for GitHub Actions. Writes markdown to stdout (and $OUT if set).
 * It never talks to GitHub itself; the workflow decides whether to post.
 *   review  <diff-file>        PR diff review (rules + Security agent; Nano triage + Super analysis with a key)
 *   explain <log-file>         CI failure analysis + suggested fix (Super with a key)
 *   audit                      unsafe-config / security audit of the tracked tree
 *   release <base> <head>      release notes from commits in base..head
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { reviewDiff, reviewMarkdown } from "../src/lib/whisperer/diff";
import { analyzeCiLog, ciMarkdown } from "../src/lib/whisperer/cilog";
import { auditConfig } from "../src/lib/whisperer/configaudit";
import { releaseNotes } from "../src/lib/whisperer/releasenotes";
import { enterGrounding } from "../src/lib/pcm/dna.server";
import { nebiusChat } from "../src/lib/agent/llm.server";
import { tierModel } from "../src/lib/agent/nebius";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
function trackedFiles(): Record<string, string> {
  const out: Record<string, string> = {};
  const list = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8", maxBuffer: 50e6 }).split("\n").filter(Boolean);
  for (const p of list) {
    if (/node_modules|\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip|lock)$|package-lock\.json$/.test(p)) continue;
    try {
      const c = readFileSync(`${root}/${p}`, "utf8");
      if (c.length < 300_000) out[p] = c;
    } catch { /* unreadable */ }
  }
  return out;
}
const key = !!process.env.NEBIUS_API_KEY;
async function ask(tier: "nano" | "super", system: string, user: string, maxTokens: number) {
  const r = await nebiusChat({ model: tierModel(tier, process.env), maxTokens, temperature: 0.1, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
  return { text: r.text.trim(), model: r.model };
}

async function main() {
  const [mode, a, b] = process.argv.slice(2);
  let md = "";
  let code = 0;
  if (mode !== "release") await enterGrounding(trackedFiles());
  if (mode === "review") {
    const diff = readFileSync(a, "utf8").slice(0, 400_000);
    const r = reviewDiff(diff);
    let triage: string | undefined, analysis: string | undefined;
    const models: string[] = [];
    if (key) {
      try {
        const t = await ask("nano", "You are a fast PR triage reviewer. List at most 5 findings that truly matter (mark likely false positives). Bullets only.", `Findings:\n${JSON.stringify(r.findings.slice(0, 40))}\n\nDiff:\n${diff.slice(0, 24_000)}`, 600);
        triage = t.text; models.push(t.model);
        const s = await ask("super", "Senior reviewer. Report (1) likely bugs with file:line, (2) risks, (3) missing tests (exact cases). Bullets; 'none' for empty sections. Do not invent files.", diff.slice(0, 60_000), 1400);
        analysis = s.text; models.push(s.model);
      } catch (e) { analysis = `_Nemotron call failed: ${(e as Error).message}_`; }
    }
    md = reviewMarkdown(r, { triage, analysis, models });
  } else if (mode === "explain") {
    const log = readFileSync(a, "utf8");
    const an = analyzeCiLog(log.slice(-400_000));
    let explanation: string | undefined, model: string | undefined;
    if (key) {
      try {
        const s = await ask("super", "Explain this CI failure: root cause in one sentence, then the minimal fix (file/line/command when known). Never guess unseen file contents.", `Signals:\n${JSON.stringify(an.failures)}\n\nLog tail:\n${log.slice(-12_000)}`, 900);
        explanation = s.text; model = s.model;
      } catch (e) { explanation = `_Nemotron call failed: ${(e as Error).message}_`; }
    }
    md = ciMarkdown(an, { explanation, model });
  } else if (mode === "audit") {
    const r = auditConfig(trackedFiles());
    md = ["### CI Whisperer — config & security audit", `${r.findings.length} findings; blocking: ${r.blocking ? "yes" : "no"}.`, "", ...r.findings.slice(0, 80).map((f) => `- **${f.severity}** \`${f.file}${f.line ? `:${f.line}` : ""}\` ${f.rule} — ${f.message}`)].join("\n");
    if (r.blocking && process.env.WHISPERER_STRICT === "1") code = 1;
  } else if (mode === "release") {
    const raw = execFileSync("git", ["log", "--format=%H%x1f%B%x1e", `${a}..${b}`], { cwd: root, encoding: "utf8", maxBuffer: 50e6 });
    const commits = raw.split("\x1e").map((x) => x.trim()).filter(Boolean).map((x) => { const [sha, message] = x.split("\x1f"); return { sha, message }; });
    md = releaseNotes(commits, { repoUrl: process.env.GITHUB_REPOSITORY ? `https://github.com/${process.env.GITHUB_REPOSITORY}` : undefined });
  } else {
    console.error("usage: whisperer-ci.ts review <diff> | explain <log> | audit | release <base> <head>");
    process.exit(2);
  }
  process.stdout.write(md + "\n");
  if (process.env.OUT) writeFileSync(process.env.OUT, md + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
  process.exit(code);
}
main().catch((e) => { console.error(e); process.exit(1); });
