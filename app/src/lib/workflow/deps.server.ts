import type { WfDeps as EngineDeps } from "./engine";
import { nebiusChat } from "../agent/llm.server";
import { NEMOTRON } from "../agent/nebius";
import { scanSecurity } from "../meridian/security";
import { checkCompliance } from "../meridian/compliance";
import { execInSandbox } from "../agent/sandbox.server";

/** Live engine deps: Nemotron on Nebius, Meridian tools, sandbox checks. */
export function liveDeps(): EngineDeps {
  return {
    llm: async (prompt, tier) => {
      const r = await nebiusChat({ model: NEMOTRON[tier], maxTokens: 1500, temperature: 0.2, messages: [{ role: "user", content: prompt }] });
      return { text: r.text, model: r.model, costUsd: r.costUsd };
    },
    tool: async (name, f, _node, vars) => {
      if (name === "security-scan") return JSON.stringify(scanSecurity(f));
      if (name === "compliance") return JSON.stringify(checkCompliance(f, scanSecurity(f)));
      return vars.input ?? "";
    },
    check: async (command, f) => {
      const r = await execInSandbox(f, command);
      return { exitCode: r.exitCode, output: (r.stdout + r.stderr).slice(-8000) };
    },
  };
}
