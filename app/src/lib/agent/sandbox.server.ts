// Code execution backends for the write -> run -> test loop.
//  - "vercel": @vercel/sandbox Firecracker microVM (default when running on Vercel)
//  - "docker": throwaway container, no network (SANDBOX_RUNNER=docker)
//  - "local":  child process in a temp dir with a scrubbed env and timeout (dev only)
import type { ExecResult, LoopFiles } from "./loop-core";

const TIMEOUT_MS = Number(process.env.SANDBOX_TIMEOUT_MS || 60_000);

export function pickRunner(): "vercel" | "docker" | "local" {
  const forced = process.env.SANDBOX_RUNNER;
  if (forced === "vercel" || forced === "docker" || forced === "local") return forced;
  if (process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN) return "vercel";
  return "local";
}

export async function execInSandbox(files: LoopFiles, command: string): Promise<ExecResult> {
  const runner = pickRunner();
  if (runner === "vercel") return execVercel(files, command);
  return execProcess(files, command, runner);
}

async function execVercel(files: LoopFiles, command: string): Promise<ExecResult> {
  const { Sandbox } = await import("@vercel/sandbox");
  const started = Date.now();
  const sandbox = await Sandbox.create({ runtime: "node22", timeout: TIMEOUT_MS + 30_000 });
  try {
    await sandbox.writeFiles(
      Object.entries(files).map(([path, content]) => ({ path, content: Buffer.from(content) })),
    );
    const done = await sandbox.runCommand("bash", ["-lc", command]);
    const [stdout, stderr] = await Promise.all([done.stdout(), done.stderr()]);
    return { exitCode: done.exitCode, stdout, stderr, ms: Date.now() - started, runner: "vercel-sandbox" };
  } finally {
    await sandbox.stop().catch(() => {});
  }
}

async function execProcess(files: LoopFiles, command: string, runner: "docker" | "local"): Promise<ExecResult> {
  const { mkdtemp, mkdir, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { spawn } = await import("node:child_process");

  const dir = await mkdtemp(path.join(tmpdir(), "codingagent-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      if (!abs.startsWith(dir + path.sep)) continue;
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, content);
    }
    const started = Date.now();
    const [cmd, args] =
      runner === "docker"
        ? [
            "docker",
            ["run", "--rm", "--network=none", "--memory=512m", "--cpus=1", "-v", `${dir}:/work`, "-w", "/work",
              process.env.SANDBOX_DOCKER_IMAGE || "node:22-slim", "bash", "-lc", command],
          ]
        : ["bash", ["-lc", command]];
    // Never leak server secrets into model-written code.
    const env = { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: dir, CI: "1", NODE_ENV: "test" };
    return await new Promise<ExecResult>((resolve) => {
      const child = spawn(cmd as string, args as string[], { cwd: dir, env });
      let stdout = "";
      let stderr = "";
      const cap = (s: string, d: Buffer) => (s.length > 200_000 ? s : s + d.toString());
      child.stdout.on("data", (d: Buffer) => (stdout = cap(stdout, d)));
      child.stderr.on("data", (d: Buffer) => (stderr = cap(stderr, d)));
      const timer = setTimeout(() => {
        stderr += `\n[sandbox] timed out after ${TIMEOUT_MS}ms`;
        child.kill("SIGKILL");
      }, TIMEOUT_MS);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({ exitCode: code ?? 1, stdout, stderr, ms: Date.now() - started, runner });
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve({ exitCode: 127, stdout, stderr: `${stderr}\n${e.message}`, ms: Date.now() - started, runner });
      });
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
