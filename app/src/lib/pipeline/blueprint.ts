// Blueprint/Architect contract: the fixed structured output Nemotron must return.
import { splitTopLevel } from "./audit";
import { ident, norm, splitStatements } from "./sql";

export type Column = {
  name: string;
  type: string;
  nullable?: boolean;
  primary?: boolean;
  unique?: boolean;
  references?: { table: string; column: string };
};
export type Table = { name: string; columns: Column[] };
export type Resource = { name: string; table: string; path: string };
export type Blueprint = { app: string; tables: Table[]; resources: Resource[]; insertOrder: string[] };

export const BLUEPRINT_CONTRACT = `Reply ONLY with JSON matching:
{"app":"string","tables":[{"name":"snake_case","columns":[{"name":"snake_case","type":"postgres type","nullable":false,"primary":false,"unique":false,"references":{"table":"t","column":"id"}}]}],"resources":[{"name":"Users","table":"users","path":"/api/users"}]}
Rules: every table has an "id" primary key; foreign keys use "references"; no prose.`;

/** Kahn topological sort so parents are inserted before children. Throws on cycles. */
export function topoSort(tables: Table[]): string[] {
  const names = new Set(tables.map((t) => t.name));
  const deps = new Map<string, Set<string>>();
  for (const t of tables) {
    deps.set(
      t.name,
      new Set(t.columns.map((c) => c.references?.table).filter((x): x is string => !!x && x !== t.name && names.has(x))),
    );
  }
  const order: string[] = [];
  const ready = tables.map((t) => t.name).filter((n) => deps.get(n)!.size === 0);
  while (ready.length) {
    const n = ready.shift()!;
    order.push(n);
    for (const [k, d] of deps) {
      if (d.delete(n) && d.size === 0 && !order.includes(k) && !ready.includes(k)) ready.push(k);
    }
  }
  if (order.length !== tables.length) {
    const stuck = tables.map((t) => t.name).filter((n) => !order.includes(n));
    throw new Error(`Foreign-key cycle between: ${stuck.join(", ")}`);
  }
  return order;
}

/** Validate/normalize an LLM blueprint against the contract. */
export function normalizeBlueprint(raw: unknown): Blueprint {
  const o = (raw ?? {}) as Partial<Blueprint>;
  if (!Array.isArray(o.tables) || !o.tables.length) throw new Error("Blueprint has no tables");
  const tables: Table[] = o.tables.map((t) => {
    if (!t?.name || !Array.isArray(t.columns)) throw new Error("Blueprint table missing name/columns");
    return {
      name: ident(String(t.name)),
      columns: t.columns.map((c) => ({
        name: ident(String(c.name)),
        type: String(c.type || "text"),
        nullable: c.nullable ?? !c.primary,
        primary: !!c.primary,
        unique: !!c.unique,
        references: c.references?.table
          ? { table: ident(c.references.table), column: ident(c.references.column || "id") }
          : undefined,
      })),
    };
  });
  const resources =
    Array.isArray(o.resources) && o.resources.length
      ? o.resources.map((r) => ({ name: String(r.name), table: ident(String(r.table)), path: String(r.path) }))
      : tables.map((t) => ({ name: t.name, table: t.name, path: `/api/${t.name}` }));
  return { app: String(o.app || "app"), tables, resources, insertOrder: topoSort(tables) };
}

/** Derive a blueprint deterministically from CREATE TABLE statements. */
export function blueprintFromSql(sql: string, app = "app"): Blueprint {
  const tables: Table[] = [];
  for (const s of splitStatements(sql)) {
    const m = norm(s).match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\(([\s\S]*)\)\s*$/i);
    if (!m) continue;
    const cols: Column[] = [];
    for (const part of splitTopLevel(m[2]!)) {
      const p = part.trim();
      const cm = p.match(/^"?(\w+)"?\s+([\w ]+?(?:\([\d, ]+\))?)(?=\s|$)/);
      if (!cm || /^(constraint|primary|foreign|unique|check)$/i.test(cm[1]!)) continue;
      const ref = p.match(/references\s+([\w."]+)\s*(?:\(\s*"?(\w+)"?\s*\))?/i);
      cols.push({
        name: cm[1]!.toLowerCase(),
        type: cm[2]!.trim().toLowerCase(),
        primary: /primary\s+key/i.test(p),
        unique: /\bunique\b/i.test(p),
        nullable: !/not\s+null|primary\s+key/i.test(p),
        references: ref ? { table: ident(ref[1]!), column: (ref[2] ?? "id").toLowerCase() } : undefined,
      });
    }
    tables.push({ name: ident(m[1]!), columns: cols });
  }
  return normalizeBlueprint({ app, tables });
}

/** Safe migration from a blueprint: transactional, idempotent, FK columns indexed. */
export function blueprintToSql(bp: Blueprint): string {
  const byName = new Map(bp.tables.map((t) => [t.name, t]));
  const lines = ["BEGIN;"];
  for (const name of bp.insertOrder) {
    const t = byName.get(name)!;
    const cols = t.columns.map((c) => {
      const bits = [c.name, c.primary && /^(int|integer|serial|bigint|bigserial)$/i.test(c.type) ? "serial" : c.type];
      if (c.primary) bits.push("PRIMARY KEY");
      else if (!c.nullable) bits.push("NOT NULL");
      if (c.unique && !c.primary) bits.push("UNIQUE");
      if (c.references) bits.push(`REFERENCES ${c.references.table}(${c.references.column}) ON DELETE CASCADE`);
      return `  ${bits.join(" ")}`;
    });
    lines.push(`CREATE TABLE IF NOT EXISTS ${t.name} (\n${cols.join(",\n")}\n);`);
    for (const c of t.columns.filter((c) => c.references)) {
      lines.push(`CREATE INDEX IF NOT EXISTS idx_${t.name}_${c.name} ON ${t.name} (${c.name});`);
    }
  }
  lines.push("COMMIT;");
  return lines.join("\n");
}
