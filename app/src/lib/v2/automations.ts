// Automations: cron- or webhook-triggered workflow runs. Persistence and the runner are injected.
import { createHmac, timingSafeEqual } from "node:crypto";
import { nextRun, parseCron } from "./cron";

export type Trigger = { kind: "cron"; cron: string } | { kind: "webhook"; secretEnv: string };
export type Automation = { id: string; name: string; enabled: boolean; trigger: Trigger; workflowId: string; input: string; lastRun?: string; nextRun?: string };
export type RunRecord = { automationId: string; at: string; via: "cron" | "webhook" | "manual"; ok: boolean; summary: string };
export type Runner = (a: Automation, input: string) => Promise<{ ok: boolean; summary: string }>;

export function validateAutomation(a: Automation): string[] {
  const e: string[] = [];
  if (!/^[a-z0-9-]{1,64}$/.test(a.id)) e.push("id must be lowercase letters, digits or dashes");
  if (a.trigger.kind === "cron") { try { parseCron(a.trigger.cron); } catch (x) { e.push((x as Error).message); } }
  else if (!/^[A-Z][A-Z0-9_]*$/.test(a.trigger.secretEnv)) e.push("secretEnv must name an env var (the secret itself is never stored)");
  return e;
}

export class Scheduler {
  runs: RunRecord[] = [];
  constructor(public automations: Automation[], private runner: Runner, private now: () => Date = () => new Date()) {
    for (const a of automations) this.schedule(a);
  }
  private schedule(a: Automation) {
    if (a.trigger.kind === "cron") a.nextRun = nextRun(a.trigger.cron, this.now()).toISOString();
  }
  private async fire(a: Automation, via: RunRecord["via"], input: string) {
    let rec: RunRecord;
    try { const r = await this.runner(a, input); rec = { automationId: a.id, at: this.now().toISOString(), via, ...r }; }
    catch (x) { rec = { automationId: a.id, at: this.now().toISOString(), via, ok: false, summary: (x as Error).message }; }
    a.lastRun = rec.at; this.runs.push(rec); return rec;
  }
  /** Run every enabled cron automation that is due. Call once a minute (setInterval or an external cron). */
  async tick(): Promise<RunRecord[]> {
    const out: RunRecord[] = [];
    for (const a of this.automations) {
      if (!a.enabled || a.trigger.kind !== "cron" || !a.nextRun) continue;
      if (new Date(a.nextRun) <= this.now()) { out.push(await this.fire(a, "cron", a.input)); this.schedule(a); }
    }
    return out;
  }
  async runNow(id: string, input?: string) {
    const a = this.automations.find((x) => x.id === id); if (!a) throw new Error("unknown automation");
    return this.fire(a, "manual", input ?? a.input);
  }
  /** Webhook: body must be signed with HMAC-SHA256 of the raw body using the secret in env[secretEnv]. */
  async webhook(id: string, rawBody: string, signature: string | null, env: Record<string, string | undefined>) {
    const a = this.automations.find((x) => x.id === id);
    if (!a || a.trigger.kind !== "webhook" || !a.enabled) return { status: 404 as const };
    const secret = env[a.trigger.secretEnv];
    if (!secret) return { status: 503 as const };
    if (!verifySignature(secret, rawBody, signature)) return { status: 401 as const };
    let input = a.input;
    try { const j = JSON.parse(rawBody) as { input?: unknown }; if (typeof j.input === "string") input = j.input; } catch { /* raw */ }
    return { status: 200 as const, run: await this.fire(a, "webhook", input) };
  }
}

export function sign(secret: string, body: string) { return "sha256=" + createHmac("sha256", secret).update(body).digest("hex"); }
export function verifySignature(secret: string, body: string, sig: string | null): boolean {
  if (!sig) return false;
  const a = Buffer.from(sign(secret, body)), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
