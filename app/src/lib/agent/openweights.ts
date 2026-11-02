/**
 * Optional open-weight model providers. Client-safe: no keys, no environment reads.
 * Nemotron on Nebius Token Factory stays the default for every role; every provider
 * here is optIn, so automatic routing and fallbacks never pick it.
 *
 * Verification (2026-11-02): ids marked verified appear as current serverless models in
 * Nebius docs (chat examples / Nov-2026 deprecation replacements), or in the provider's
 * public /v1/models list. verified:false = id only seen in Nebius fine-tuning / dedicated
 * endpoint docs; it may not be served on Serverless. Check before relying on it.
 */
import type { ProviderDef, ProviderModel } from "./types";
import { BUILT_WITH_LLAMA } from "./llama";

export const OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const HF_BASE_URL = "https://router.huggingface.co/v1";
export const OPEN_WEIGHT_PROVIDERS = ["nebius-open", "ollama", "openrouter-free", "hf"] as const;
export type OpenWeightProviderId = (typeof OPEN_WEIGHT_PROVIDERS)[number];

export function isOpenWeightProvider(id: string | undefined | null): id is OpenWeightProviderId {
  return !!id && (OPEN_WEIGHT_PROVIDERS as readonly string[]).includes(id);
}

const m = (id: string, label: string, license: string, speed: ProviderModel["speed"], verified = true, extra: Partial<ProviderModel> = {}): ProviderModel =>
  ({ id, label, license, speed, verified, free: false, roles: [], ...extra });
const llama = { attribution: BUILT_WITH_LLAMA };

/** Nebius Token Factory open-weight catalog (same NEBIUS_API_KEY and base URL as Nemotron). */
export const NEBIUS_OPEN_MODELS: ProviderModel[] = [
  m("openai/gpt-oss-120b", "gpt-oss 120B", "Apache-2.0", "quality"),
  m("Qwen/Qwen3-30B-A3B-Instruct-2507", "Qwen3 30B A3B Instruct 2507", "Apache-2.0", "fast"),
  m("deepseek-ai/DeepSeek-V4-Pro-0813", "DeepSeek V4 Pro 0813", "see model card", "quality"),
  m("zai-org/GLM-5.2", "GLM 5.2", "see model card", "quality"),
  m("moonshotai/Kimi-K3", "Kimi K3", "see model card", "quality"),
  m("MiniMaxAI/MiniMax-M3", "MiniMax M3", "see model card", "medium"),
  m("Qwen/Qwen3-Coder-480B-A35B-Instruct", "Qwen3 Coder 480B (unverified)", "Apache-2.0", "quality", false),
  m("Qwen/Qwen3-Coder-30B-A3B-Instruct", "Qwen3 Coder 30B (unverified)", "Apache-2.0", "fast", false),
  m("openai/gpt-oss-20b", "gpt-oss 20B (unverified)", "Apache-2.0", "fast", false),
  m("google/gemma-4-31B-it", "Gemma 4 31B (unverified)", "Apache-2.0", "medium", false),
  m("meta-llama/Meta-Llama-3.1-8B-Instruct", "Llama 3.1 8B (unverified)", "Llama 3.1 Community License", "fast", false, llama),
  m("mistralai/Mistral-Nemo-Instruct-2407", "Mistral Nemo 2407 (unverified)", "Apache-2.0", "fast", false),
];

/** OpenRouter ":free" models (public model list, 2026-11-02). Needs OPENROUTER_API_KEY. */
export const OPENROUTER_FREE_MODELS: ProviderModel[] = [
  m("google/gemma-4-31b-it:free", "Gemma 4 31B (free)", "Apache-2.0", "medium", true, { free: true }),
  m("google/gemma-4-26b-a4b-it:free", "Gemma 4 26B A4B (free)", "Apache-2.0", "fast", true, { free: true }),
  m("nvidia/nemotron-3.5-lightning:free", "Nemotron 3.5 Lightning (free)", "NVIDIA Open Model License", "fast", true, { free: true }),
];

/** Hugging Face Inference Providers router (public /v1/models list, 2026-11-02). Needs HF_TOKEN. */
export const HF_MODELS: ProviderModel[] = [
  m("openai/gpt-oss-120b", "gpt-oss 120B", "Apache-2.0", "quality"),
  m("openai/gpt-oss-20b", "gpt-oss 20B", "Apache-2.0", "fast"),
  m("google/gemma-4-31B-it", "Gemma 4 31B", "Apache-2.0", "medium"),
  m("deepseek-ai/DeepSeek-V4-Pro-0813", "DeepSeek V4 Pro 0813", "see model card", "quality"),
  m("zai-org/GLM-5.3", "GLM 5.3", "see model card", "quality"),
  m("moonshotai/Kimi-K3", "Kimi K3", "see model card", "quality"),
  m("meta-llama/Llama-3.3-70B-Instruct", "Llama 3.3 70B", "Llama 3.3 Community License", "medium", true, llama),
];

export const OPEN_WEIGHT_PROVIDER_DEFS: ProviderDef[] = [
  {
    id: "nebius-open",
    name: "Open-weight models · Nebius Token Factory (optional)",
    baseUrl: "https://api.tokenfactory.nebius.com/v1",
    builtIn: true,
    optIn: true,
    docs: "https://tokenfactory.nebius.com/models",
    keyHint: "Same server-side NEBIUS_API_KEY as Nemotron",
    models: NEBIUS_OPEN_MODELS,
  },
  {
    id: "ollama",
    name: "Local open weights · Ollama (optional)",
    baseUrl: OLLAMA_BASE_URL,
    builtIn: true,
    optIn: true,
    docs: "https://ollama.com",
    keyHint: "Server-side OLLAMA_BASE_URL (default 127.0.0.1:11434) and LOCAL_MODEL",
    models: [m("local", "LOCAL_MODEL on the Ollama server", "license of the pulled model", "fast", true, { free: true })],
  },
  {
    id: "openrouter-free",
    name: "OpenRouter free open-weight models (optional)",
    baseUrl: OPENROUTER_BASE_URL,
    builtIn: true,
    optIn: true,
    docs: "https://openrouter.ai/models?q=free",
    keyHint: "Server-side OPENROUTER_API_KEY · off unless set",
    models: OPENROUTER_FREE_MODELS,
  },
  {
    id: "hf",
    name: "Hugging Face Inference (optional)",
    baseUrl: HF_BASE_URL,
    builtIn: true,
    optIn: true,
    docs: "https://huggingface.co/docs/inference-providers",
    keyHint: "Server-side HF_TOKEN · off unless set",
    models: HF_MODELS,
  },
];

export function modelAttribution(providerId: string, model: string): string | undefined {
  const p = OPEN_WEIGHT_PROVIDER_DEFS.find((x) => x.id === providerId);
  return p?.models.find((x) => x.id === model)?.attribution;
}
