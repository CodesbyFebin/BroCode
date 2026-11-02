// Repo-aware agent helpers: clone, branch, apply files, commit, diff, open PR via gh.
// Uses execFile (no shell). PR creation needs GH_TOKEN in env and BROCODE_ALLOW_PR=1; otherwise it returns a dry-run.
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
const run = promisify(execFile);

export class RepoAgent {
  constructor(public dir: string, private env: Record<string, string | undefined> = process.env) {}
  private async git(...args: string[]) {
    const r = await run("git", args, { cwd: this.dir, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, maxBuffer: 16 << 20 });
    return r.stdout.trim();
  }
  static async clone(url: string, dir: string, env?: Record<string, string | undefined>) {
    if (!/^(https:\/\/|file:\/\/|\/)/.test(url)) throw new Error("only https, file:// or absolute-path remotes are allowed");
    await run("git", ["clone", "--depth", "50", "--", url, dir], { env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
    return new RepoAgent(dir, env);
  }
  async branch(name: string) {
    if (!/^[A-Za-z0-9._/-]{1,100}$/.test(name) || name.includes("..")) throw new Error("bad branch name");
    return this.git("checkout", "-b", name);
  }
  async applyFiles(files: Record<string, string>) {
    const root = resolve(this.dir);
    for (const [p, c] of Object.entries(files)) {
      const full = resolve(root, p);
      if (!full.startsWith(root + sep) || p.split(/[\\/]/).includes(".git")) throw new Error(`unsafe path ${p}`);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, c);
    }
  }
  diff() { return this.git("diff", "HEAD"); }
  async commit(message: string, author = "BroCODE Agent <agent@brocode.local>") {
    await this.git("add", "-A");
    const [name, email] = [author.replace(/\s*<.*/, ""), /<(.*)>/.exec(author)?.[1] ?? "agent@brocode.local"];
    await this.git("-c", `user.name=${name}`, "-c", `user.email=${email}`, "commit", "-m", message);
    return this.git("rev-parse", "HEAD");
  }
  currentBranch() { return this.git("rev-parse", "--abbrev-ref", "HEAD"); }
  /** Returns the gh command; only executes it when GH_TOKEN and BROCODE_ALLOW_PR=1 are both set. */
  async openPr(repo: string, title: string, body: string, base = "main") {
    const head = await this.currentBranch();
    const args = ["pr", "create", "--repo", repo, "--base", base, "--head", head, "--title", title, "--body", body];
    if (!this.env.GH_TOKEN || this.env.BROCODE_ALLOW_PR !== "1") return { dryRun: true as const, command: ["gh", ...args] };
    await this.git("push", "-u", "origin", head);
    const r = await run("gh", args, { cwd: this.dir, env: { ...process.env, GH_TOKEN: this.env.GH_TOKEN } });
    return { dryRun: false as const, url: r.stdout.trim() };
  }
}
export const repoPath = (base: string, name: string) => join(base, name.replace(/[^A-Za-z0-9._-]/g, "_"));
