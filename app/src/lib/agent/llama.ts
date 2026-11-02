/**
 * Optional Llama providers. Nemotron on Nebius stays the default for every role;
 * these are used only when explicitly selected. Client-safe: no keys here.
 */
export const META_BASE_URL = "https://api.meta.ai/v1"; // unverified; override with META_BASE_URL
export const META_MODELS = { default: "muse-spark-1.3-contributor", wonder: "muse-wonder-1.0" } as const;
/** USD per 1M tokens, as supplied by the user (not verified against a public price list). */
export const META_PRICE = { input: 0.1, output: 0.2 } as const;
export const LOCAL_LLAMA_BASE_URL = "http://127.0.0.1:8089/v1"; // llama.cpp server, see /workspace/local-llm
export const LLAMA_PROVIDERS = ["meta", "local-llama"] as const;
export const BUILT_WITH_LLAMA = "Built with Llama";

export function isLlamaProvider(id: string | undefined | null): boolean {
  return !!id && (LLAMA_PROVIDERS as readonly string[]).includes(id);
}

export function metaCostUsd(usage: { prompt_tokens?: number; completion_tokens?: number } | undefined): number {
  return ((usage?.prompt_tokens ?? 0) * META_PRICE.input + (usage?.completion_tokens ?? 0) * META_PRICE.output) / 1_000_000;
}

/** Worst-case cost of a call before it is made (chars/4 prompt estimate + full max_tokens). */
export function metaEstimateUsd(promptChars: number, maxTokens: number): number {
  return metaCostUsd({ prompt_tokens: Math.ceil(promptChars / 4), completion_tokens: maxTokens });
}
