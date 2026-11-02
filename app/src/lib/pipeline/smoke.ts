// Smoke Tester: infer health/list/create/delete checks per resource and run them.
import type { Blueprint } from "./blueprint";
import { valueFor } from "./datasmith";

export type SmokeCheck = { resource: string; kind: "health" | "list" | "create" | "delete"; sql: string };
export type SmokeResult = SmokeCheck & { ok: boolean; detail: string; ms: number };
export type SqlRunner = { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> };

export function inferSmokeChecks(bp: Blueprint): SmokeCheck[] {
  const checks: SmokeCheck[] = [{ resource: bp.app, kind: "health", sql: "SELECT 1 AS ok" }];
  const byName = new Map(bp.tables.map((t) => [t.name, t]));
  for (const r of bp.resources) {
    const t = byName.get(r.table);
    if (!t) continue;
    checks.push({ resource: r.name, kind: "list", sql: `SELECT count(*)::int AS n FROM ${t.name}` });
    const cols = t.columns.filter((c) => !c.primary && !(c.references?.table === t.name));
    const vals = cols.map((c) => valueFor(c, t.name, 9001, 1)); // FK -> row 1 (seeded)
    const pk = t.columns.find((c) => c.primary)?.name ?? "id";
    checks.push({
      resource: r.name,
      kind: "create",
      sql: `INSERT INTO ${t.name} (${cols.map((c) => c.name).join(", ")}) VALUES (${vals.join(", ")}) RETURNING ${pk}`,
    });
    checks.push({ resource: r.name, kind: "delete", sql: `DELETE FROM ${t.name} WHERE ${pk} = $CREATED RETURNING ${pk}` });
  }
  return checks;
}

export async function runSmoke(db: SqlRunner, checks: SmokeCheck[]): Promise<SmokeResult[]> {
  const results: SmokeResult[] = [];
  let created: unknown = null;
  for (const c of checks) {
    const started = Date.now();
    try {
      let sql = c.sql;
      if (c.kind === "delete") {
        if (created == null) throw new Error("create step did not return a key");
        sql = sql.replace("$CREATED", typeof created === "number" ? String(created) : `'${String(created)}'`);
      }
      const r = await db.query(sql);
      if (c.kind === "create") created = Object.values(r.rows[0] ?? {})[0] ?? null;
      if (c.kind === "delete" && !r.rows.length) throw new Error("row not deleted");
      results.push({ ...c, sql, ok: true, detail: JSON.stringify(r.rows[0] ?? {}).slice(0, 120), ms: Date.now() - started });
    } catch (e) {
      results.push({ ...c, ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - started });
    }
    if (c.kind === "delete") created = null;
  }
  return results;
}
