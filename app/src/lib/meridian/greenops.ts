// GreenOps agent: compute/carbon ESTIMATE from measured token usage + sandbox time, under explicit assumptions.
import type { GreenOut } from "./contracts";

/** Active parameters (billions), taken from the model names (A3B / A12B / A55B). */
export function activeParamsB(model: string): number {
  const m = model.match(/a(\d+(?:\.\d+)?)b\b/i);
  return m ? Number(m[1]) : 12;
}

export type GreenAssumptions = { flopsPerJoule: number; pue: number; gridGCO2PerKWh: number; sandboxWatts: number };
export const DEFAULT_ASSUMPTIONS: GreenAssumptions = {
  flopsPerJoule: 4e11, // ~H100 BF16 dense peak (~1.4e12 FLOP/J) at ~30% utilisation
  pue: 1.2,
  gridGCO2PerKWh: 475, // approx. global average grid intensity; override with GREENOPS_GRID_G_PER_KWH
  sandboxWatts: 15, // one small vCPU container
};

export function estimateGreen(usage: { model: string; tokens: number }[], sandboxMs: number, a: GreenAssumptions = DEFAULT_ASSUMPTIONS): GreenOut {
  const llm = usage.map((u) => {
    const p = activeParamsB(u.model);
    const flops = 2 * p * 1e9 * u.tokens;
    const kWh = ((flops / a.flopsPerJoule) * a.pue) / 3.6e6;
    return { model: u.model, tokens: u.tokens, activeParamsB: p, flops, kWh, gCO2: kWh * a.gridGCO2PerKWh };
  });
  const sandboxKWh = ((a.sandboxWatts * sandboxMs) / 1000 / 3.6e6) * a.pue;
  const kWh = llm.reduce((s, x) => s + x.kWh, 0) + sandboxKWh;
  return {
    llm,
    sandboxSeconds: sandboxMs / 1000,
    totals: { tokens: llm.reduce((s, x) => s + x.tokens, 0), kWh, gCO2: kWh * a.gridGCO2PerKWh },
    assumptions: [
      "Token counts and sandbox time are measured in this run; energy and carbon are estimates.",
      "Inference FLOPs ≈ 2 × active parameters × tokens (active params read from the model id).",
      `Effective efficiency ${a.flopsPerJoule.toExponential(1)} FLOP/J, PUE ${a.pue}, grid ${a.gridGCO2PerKWh} gCO2/kWh, sandbox ${a.sandboxWatts} W.`,
    ],
  };
}

export function assumptionsFromEnv(env: Record<string, string | undefined>): GreenAssumptions {
  const n = (k: string, d: number) => (Number.isFinite(Number(env[k])) && env[k] ? Number(env[k]) : d);
  return {
    flopsPerJoule: n("GREENOPS_FLOPS_PER_JOULE", DEFAULT_ASSUMPTIONS.flopsPerJoule),
    pue: n("GREENOPS_PUE", DEFAULT_ASSUMPTIONS.pue),
    gridGCO2PerKWh: n("GREENOPS_GRID_G_PER_KWH", DEFAULT_ASSUMPTIONS.gridGCO2PerKWh),
    sandboxWatts: n("GREENOPS_SANDBOX_WATTS", DEFAULT_ASSUMPTIONS.sandboxWatts),
  };
}
