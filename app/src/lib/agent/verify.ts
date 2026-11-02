import { createServerFn } from "@tanstack/react-start";
import type { LoopFiles, LoopOutcome } from "./loop-core";

export type VerifyRequest = { files: LoopFiles; task: string; command?: string; maxAttempts?: number };

const MAX_FILES = 60;
const MAX_BYTES = 400_000;

/** Server-side write -> run -> test loop; failures are repaired by Nemotron 3 Ultra. */
export const runVerifyLoop = createServerFn({ method: "POST" })
  .validator((input: VerifyRequest) => input)
  .handler(async ({ data }): Promise<LoopOutcome & { command: string | null }> => {
    await (await import("../pcm/dna.server")).enterGrounding(data.files);
    const core = await import("./loop-core");
    const { execInSandbox } = await import("./sandbox.server");
    const { nebiusChat } = await import("./llm.server");
    const { tierModel } = await import("./nebius");

    const files: LoopFiles = {};
    let bytes = 0;
    for (const [p, c] of Object.entries(data.files ?? {}).slice(0, MAX_FILES)) {
      const safe = core.safeRelPath(p);
      if (!safe || typeof c !== "string") continue;
      bytes += c.length;
      if (bytes > MAX_BYTES) break;
      files[safe] = c;
    }
    const command = data.command?.trim() || core.detectTestCommand(files);
    if (!command) {
      return { passed: false, attempts: 0, steps: [], files, changed: [], costUsd: 0, command: null };
    }

    const ultra = tierModel("ultra", process.env);
    const outcome = await core.runRepairLoop(
      { files, command, maxAttempts: data.maxAttempts ?? Number(process.env.REPAIR_MAX_ATTEMPTS || 3) },
      {
        exec: execInSandbox,
        repair: async ({ files: cur, output, attempt }) => {
          const listing = Object.entries(cur)
            .map(([p, c]) => `--- ${p}\n${c.slice(0, 6000)}`)
            .join("\n");
          const r = await nebiusChat({
            model: ultra,
            maxTokens: 4000,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content:
                  'You are the repair agent of a coding agent. Tests failed. Fix the SOURCE (not the tests, unless a test is clearly wrong). Reply ONLY with JSON: {"note":"one-sentence diagnosis","files":[{"path":"rel/path","content":"FULL new file content"}]}',
              },
              {
                role: "user",
                content: `Task: ${data.task.slice(0, 2000)}\nCommand: ${command}\nAttempt: ${attempt}\n\nFailure output:\n${output}\n\nWorkspace:\n${listing.slice(0, 60_000)}`,
              },
            ],
          });
          const parsed = core.parseRepairJson(r.text);
          return {
            files: parsed.files,
            note: parsed.note,
            model: r.model,
            costUsd: r.costUsd,
            tokens: (r.usage.prompt_tokens ?? 0) + (r.usage.completion_tokens ?? 0),
          };
        },
      },
    );
    return { ...outcome, command };
  });
