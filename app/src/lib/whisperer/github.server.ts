import { execFile } from "node:child_process";

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

/** Read-only gh calls (diff, logs, commits). Never writes to GitHub. */
function gh(args: string[], maxBuffer = 20 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) =>
    execFile("gh", args, { timeout: 60_000, maxBuffer }, (err, stdout, stderr) => (err ? reject(new Error((stderr || err.message).slice(0, 500))) : resolve(stdout))),
  );
}
const check = (repo: string) => {
  if (!REPO.test(repo)) throw new Error("repo must be owner/name");
};

export async function fetchPrDiff(repo: string, pr: number) {
  check(repo);
  return gh(["pr", "diff", String(Math.trunc(pr)), "--repo", repo]);
}
export async function fetchFailedRunLog(repo: string, runId: number) {
  check(repo);
  return gh(["run", "view", String(Math.trunc(runId)), "--repo", repo, "--log-failed"]);
}
export async function fetchCommits(repo: string, base: string, head: string) {
  check(repo);
  if (!/^[\w./-]+$/.test(base) || !/^[\w./-]+$/.test(head)) throw new Error("bad ref");
  const out = await gh(["api", `repos/${repo}/compare/${base}...${head}`, "--jq", ".commits[] | {sha: .sha, message: .commit.message, author: .commit.author.name}"]);
  return out.split("\n").filter(Boolean).map((l) => JSON.parse(l) as { sha: string; message: string; author: string });
}
