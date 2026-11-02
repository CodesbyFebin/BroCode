import { createServerFn } from "@tanstack/react-start";
import type { AuditResult } from "./audit";
import type { Blueprint } from "./blueprint";
import type { SmokeResult } from "./smoke";
import type { PreviewInfo } from "./shadow.server";

export type StepStatus = "ok" | "warn" | "fail" | "blocked" | "skipped";
export type PipelineStep = { name: string; status: StepStatus; summary: string; evidence?: string; model?: string; costUsd?: number; ms: number };
export type PipelineResult = {
  steps: PipelineStep[];
  audit: AuditResult | null;
  blueprint: Blueprint | null;
  seedSql: string | null;
  smoke: SmokeResult[];
  preview: PreviewInfo | null;
  blocked: boolean;
};
export type PipelineRequest = { prompt?: string; migrationSql?: string; files?: Record<string, string> };

/** Run Architect -> Auditor -> Gate -> Data Smith -> Shadow preview -> Smoke Tester. Deploy is separate. */
export const runPipeline = createServerFn({ method: "POST" })
  .validator((input: PipelineRequest) => input)
  .handler(async ({ data }): Promise<PipelineResult> => {
    await (await import("../pcm/dna.server")).enterGrounding(data.files);
    const A = await import("./audit");
    const B = await import("./blueprint");
    const D = await import("./datasmith");
    const S = await import("./smoke");
    const shadow = await import("./shadow.server");
    const { nebiusChat } = await import("../agent/llm.server");
    const { tierModel } = await import("../agent/nebius");
    const hasKey = !!process.env.NEBIUS_API_KEY;
    const steps: PipelineStep[] = [];
    const res: PipelineResult = { steps, audit: null, blueprint: null, seedSql: null, smoke: [], preview: null, blocked: false };
    const time = async <T>(fn: () => Promise<T>) => {
      const t = Date.now();
      const v = await fn();
      return [v, Date.now() - t] as const;
    };

    // 1. Architect
    let sql = (data.migrationSql ?? "").slice(0, 100_000);
    try {
      if (sql.trim()) {
        const [bp, ms] = await time(async () => B.blueprintFromSql(sql));
        res.blueprint = bp;
        steps.push({ name: "Architect", status: "ok", summary: `Blueprint derived from SQL: ${bp.tables.length} tables, insert order ${bp.insertOrder.join(" → ")}`, evidence: JSON.stringify(bp, null, 2), ms });
      } else if (data.prompt && hasKey) {
        const model = tierModel("super", process.env);
        const [r, ms] = await time(() =>
          nebiusChat({ model, maxTokens: 3000, temperature: 0.1, messages: [
            { role: "system", content: `You are the Architect. Design a Postgres schema for the app.\n${B.BLUEPRINT_CONTRACT}` },
            { role: "user", content: data.prompt!.slice(0, 4000) },
          ] }),
        );
        const json = r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1);
        const bp = B.normalizeBlueprint(JSON.parse(json));
        res.blueprint = bp;
        sql = B.blueprintToSql(bp);
        steps.push({ name: "Architect", status: "ok", summary: `Nemotron Super blueprint: ${bp.tables.length} tables, insert order ${bp.insertOrder.join(" → ")}`, evidence: JSON.stringify(bp, null, 2) + "\n\n" + sql, model, costUsd: r.costUsd, ms });
      } else {
        steps.push({ name: "Architect", status: "fail", summary: data.prompt ? "NEBIUS_API_KEY not set; paste migration SQL instead." : "Provide a migration or an app description.", ms: 0 });
        return res;
      }
    } catch (e) {
      steps.push({ name: "Architect", status: "fail", summary: `Blueprint failed: ${(e as Error).message}`, ms: 0 });
      // still audit the raw SQL if any
    }

    // 2. Auditor
    const [audit, ams] = await time(async () => A.auditMigration(sql));
    res.audit = audit;
    steps.push({
      name: "Migration Auditor",
      status: audit.verdict === "SAFE" ? "ok" : audit.verdict === "CAUTION" ? "warn" : "fail",
      summary: `Score ${audit.score}/10 — ${audit.verdict} (${audit.findings.length} findings)`,
      evidence: audit.findings.map((f) => `-${f.penalty}  ${f.rule}\n     ${f.statement}`).join("\n") + `\n\nRollback SQL:\n${audit.rollbackSql}`,
      ms: ams,
    });
    if (hasKey) {
      const model = tierModel(audit.score <= 6 ? "ultra" : "super", process.env);
      try {
        const [r, ms] = await time(() =>
          nebiusChat({ model, maxTokens: 700, temperature: 0.2, messages: [
            { role: "system", content: "You review database migrations for domain risk (PII, payments, compliance such as DPDP/GDPR/PCI, data loss, locking). Be concise: at most 5 bullets. Do not restate the numeric score." },
            { role: "user", content: `Deterministic score ${audit.score}/10 (${audit.verdict}).\n\n${sql.slice(0, 20_000)}` },
          ] }),
        );
        steps.push({ name: "Risk notes", status: "ok", summary: `Nemotron domain-risk review (${model.split("/").pop()})`, evidence: r.text, model, costUsd: r.costUsd, ms });
      } catch (e) {
        steps.push({ name: "Risk notes", status: "warn", summary: `Risk review failed: ${(e as Error).message}`, ms: 0 });
      }
    } else {
      steps.push({ name: "Risk notes", status: "skipped", summary: "NEBIUS_API_KEY not set; deterministic audit only.", ms: 0 });
    }

    // 3. Gate
    const g = A.gate(audit.score);
    steps.push({ name: "Gate", status: g.blocked ? "blocked" : "ok", summary: g.reason, ms: 0 });
    if (g.blocked || !res.blueprint) {
      res.blocked = true;
      for (const n of ["Data Smith", "Shadow preview", "Smoke Tester", "Deployer"]) steps.push({ name: n, status: "blocked", summary: g.blocked ? "Halted by gate." : "No blueprint.", ms: 0 });
      return res;
    }

    // 4. Data Smith
    const seed = D.seedSql(res.blueprint);
    res.seedSql = seed;
    steps.push({ name: "Data Smith", status: "ok", summary: `${seed.split("\n").filter((l) => l.startsWith("INSERT")).length} FK-safe INSERTs (ON CONFLICT DO NOTHING)`, evidence: seed, ms: 0 });

    // 5. Shadow preview
    const { id, db, info } = await shadow.createPreview({ verdict: audit.verdict, score: audit.score });
    res.preview = info;
    try {
      const [, ms] = await time(async () => {
        await db.exec(sql);
        await db.exec(seed);
      });
      const t = await db.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' order by 1");
      info.tables = t.rows.map((r) => r.table_name);
      let codeNote = "";
      if (data.files && Object.keys(data.files).length) {
        const core = await import("../agent/loop-core");
        const cmd = core.detectTestCommand(data.files);
        if (cmd) {
          const { execInSandbox } = await import("../agent/sandbox.server");
          const r = await execInSandbox(data.files, cmd);
          codeNote = `\nCode change: \`${cmd}\` exit ${r.exitCode}\n${core.tail(r.stdout + "\n" + r.stderr, 1500)}`;
        }
      }
      steps.push({ name: "Shadow preview", status: "ok", summary: `Preview ${id} (PGlite, TTL ${Math.round(shadow.PREVIEW_TTL_MS / 60000)} min): migration + seed applied; tables ${info.tables.join(", ")}`, evidence: codeNote || undefined, ms });
    } catch (e) {
      steps.push({ name: "Shadow preview", status: "fail", summary: `Applying migration failed: ${(e as Error).message}`, ms: 0 });
      steps.push({ name: "Smoke Tester", status: "skipped", summary: "Preview failed.", ms: 0 });
      return res;
    }

    // 6. Smoke
    const [smoke, sms] = await time(() => S.runSmoke(db, S.inferSmokeChecks(res.blueprint!)));
    res.smoke = smoke;
    info.smokeOk = smoke.every((s) => s.ok);
    steps.push({
      name: "Smoke Tester",
      status: info.smokeOk ? "ok" : "fail",
      summary: `${smoke.filter((s) => s.ok).length}/${smoke.length} checks passed`,
      evidence: smoke.map((s) => `${s.ok ? "PASS" : "FAIL"} ${s.resource} ${s.kind}: ${s.detail}`).join("\n"),
      ms: sms,
    });
    steps.push({ name: "Deployer", status: "skipped", summary: info.smokeOk ? "Awaiting explicit human confirmation." : "Smoke tests failed; deploy will be refused.", ms: 0 });
    return res;
  });

export const listShadowPreviews = createServerFn({ method: "GET" }).handler(async () => {
  const s = await import("./shadow.server");
  return s.listPreviews();
});

export const teardownShadowPreview = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const s = await import("./shadow.server");
    return { removed: await s.teardownPreview(String(data.id)) };
  });

/** Confirmation-gated deploy hook. Never deploys on its own; posts to DEPLOY_HOOK_URL only if configured. */
export const deployPreview = createServerFn({ method: "POST" })
  .validator((input: { id: string; confirm: string }) => input)
  .handler(async ({ data }) => {
    const s = await import("./shadow.server");
    const { deployDecision } = await import("./deployer");
    const p = s.getPreview(String(data.id));
    const d = deployDecision({ verdict: p?.verdict ?? null, confirm: data.confirm, smokeOk: !!p?.smokeOk });
    if (!d.allowed || !p) return { ok: false, message: d.reason };
    const hook = process.env.DEPLOY_HOOK_URL;
    if (!hook) return { ok: true, dryRun: true, message: "Confirmed. DEPLOY_HOOK_URL is not set, so nothing was deployed (dry run)." };
    const r = await fetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ previewId: p.id, verdict: p.verdict, score: p.score }) });
    p.deployed = r.ok;
    return { ok: r.ok, dryRun: false, message: `Deploy hook responded ${r.status}.` };
  });
