// Nebius Token Factory + NVIDIA Nemotron routing (pure, shared by client and server).
import type { AgentRole } from "./types";

export const NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1";

/** Nemotron tiers on Nebius Token Factory (IDs from the public model catalog). */
export const NEMOTRON = {
  nano: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
  super: "nvidia/nemotron-3-super-120b-a12b",
  ultra: "nvidia/Nemotron-3-Ultra-550b-a55b",
} as const;

export type NemotronTier = keyof typeof NEMOTRON;

/** USD per 1M tokens, from tokenfactory.nebius.com/api/public/models_info. */
export const PRICES: Record<string, { input: number; output: number }> = {
  [NEMOTRON.nano]: { input: 0.06, output: 0.24 },
  [NEMOTRON.super]: { input: 0.3, output: 0.9 },
  [NEMOTRON.ultra]: { input: 1, output: 3 },
};

/**
 * Fast everyday calls go to Nano/Super; serious reasoning (planning,
 * orchestration, repairing failing tests) goes to Ultra.
 */
export const ROLE_TIER: Record<AgentRole, NemotronTier> = {
  orchestrator: "ultra",
  planner: "ultra",
  architect: "super",
  implementer: "super",
  reviewer: "nano",
  tester: "nano",
  researcher: "nano",
  security: "super",
  compliance: "super",
  pipeline: "nano",
  greenops: "nano",
};

export function tierModel(tier: NemotronTier, env: Record<string, string | undefined> = {}) {
  const override = env[`NEBIUS_MODEL_${tier.toUpperCase()}`];
  return override?.trim() || NEMOTRON[tier];
}

export type Usage = { prompt_tokens?: number; completion_tokens?: number };

export function costUsd(model: string, usage?: Usage): number {
  const p = PRICES[model];
  if (!p || !usage) return 0;
  const inT = usage.prompt_tokens ?? 0;
  const outT = usage.completion_tokens ?? 0;
  return (inT * p.input + outT * p.output) / 1_000_000;
}

export function formatUsd(v: number) {
  if (!v) return "$0";
  return v < 0.01 ? `$${v.toFixed(5)}` : `$${v.toFixed(3)}`;
}
