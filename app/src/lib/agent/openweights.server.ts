/** Server-only config for optional open-weight providers. Keys come from env only. */
import { NEBIUS_BASE_URL } from "./nebius";
import { HF_BASE_URL, OLLAMA_BASE_URL, OPENROUTER_BASE_URL, type OpenWeightProviderId } from "./openweights";

type Env = Record<string, string | undefined>;
export type OpenWeightConfig = { baseUrl: string; apiKey?: string; model?: string; keyVar: string };

const trim = (u: string) => u.replace(/\/+$/, "");

export function openWeightConfig(id: OpenWeightProviderId, env: Env = process.env): OpenWeightConfig {
  switch (id) {
    case "nebius-open":
      return { baseUrl: trim(env.NEBIUS_BASE_URL || NEBIUS_BASE_URL), apiKey: env.NEBIUS_API_KEY, keyVar: "NEBIUS_API_KEY" };
    case "ollama":
      return { baseUrl: trim(env.OLLAMA_BASE_URL || OLLAMA_BASE_URL), apiKey: env.OLLAMA_API_KEY || "ollama", model: env.LOCAL_MODEL, keyVar: "OLLAMA_BASE_URL" };
    case "openrouter-free":
      return { baseUrl: trim(env.OPENROUTER_BASE_URL || OPENROUTER_BASE_URL), apiKey: env.OPENROUTER_API_KEY, keyVar: "OPENROUTER_API_KEY" };
    case "hf":
      return { baseUrl: trim(env.HF_BASE_URL || HF_BASE_URL), apiKey: env.HF_TOKEN, keyVar: "HF_TOKEN" };
  }
}

/** Resolve the model to send: "local" on Ollama maps to LOCAL_MODEL (default llama3.2). */
export function openWeightModel(id: OpenWeightProviderId, requested: string | undefined, cfg: OpenWeightConfig, fallback: string): string {
  if (id === "ollama" && (!requested || requested === "local")) return cfg.model || "llama3.2";
  return requested || fallback;
}
