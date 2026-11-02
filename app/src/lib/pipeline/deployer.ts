// Deployer: explicit human confirmation required; refuses DO NOT DEPLOY.
import type { Verdict } from "./audit";

export const CONFIRM_PHRASE = "DEPLOY";

export function deployDecision(input: { verdict: Verdict | null; confirm?: string; smokeOk: boolean }):
  { allowed: boolean; reason: string } {
  if (!input.verdict) return { allowed: false, reason: "No audited preview found." };
  if (input.verdict === "DO NOT DEPLOY") return { allowed: false, reason: "Refused: migration verdict is DO NOT DEPLOY." };
  if (!input.smokeOk) return { allowed: false, reason: "Refused: smoke tests did not pass in the shadow preview." };
  if (input.confirm !== CONFIRM_PHRASE) return { allowed: false, reason: `Type ${CONFIRM_PHRASE} to confirm.` };
  return { allowed: true, reason: "Confirmed by a human." };
}
