// Data Smith: deterministic, FK-safe seed SQL inferred from column names.
import type { Blueprint, Column } from "./blueprint";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function valueFor(col: Column, table: string, i: number, rows: number): string | null {
  const n = col.name;
  const t = col.type.toLowerCase();
  if (col.references) return String(((i - 1) % rows) + 1);
  if (col.primary) return /uuid/.test(t) ? q(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`) : String(i);
  if (/uuid/.test(t)) return q(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  if (/email/.test(n)) return q(`${table}${i}@example.com`);
  if (/phone|mobile/.test(n)) return q(`+91 98000 ${String(10000 + i).slice(-5)}`);
  if (/url|website|link/.test(n)) return q(`https://example.com/${table}/${i}`);
  if (/^(is|has)_|active|enabled/.test(n) || /bool/.test(t)) return i % 2 ? "true" : "false";
  if (/(_at|date|time)$/.test(n) || /timestamp|date/.test(t)) return q(`2026-01-${String(((i - 1) % 28) + 1).padStart(2, "0")}T10:00:00Z`);
  if (/price|amount|total|cost|balance/.test(n)) return (i * 199.5).toFixed(2);
  if (/qty|quantity|count|stock|age/.test(n) || /int|numeric|decimal|real|double/.test(t)) return String(i * 3);
  if (/status/.test(n)) return q(["active", "pending", "archived"][i % 3]!);
  if (/json/.test(t)) return q("{}");
  if (/name|title/.test(n)) return q(`${n.replace(/_/g, " ")} ${i}`);
  if (/password|hash|token|secret/.test(n)) return q(`seed-not-a-secret-${i}`);
  return q(`${n} ${i}`);
}

export function seedSql(bp: Blueprint, rows = 3): string {
  const byName = new Map(bp.tables.map((t) => [t.name, t]));
  const out = ["BEGIN;"];
  for (const name of bp.insertOrder) {
    const t = byName.get(name)!;
    for (let i = 1; i <= rows; i++) {
      const cols = t.columns.filter((c) => !(c.references?.table === t.name)); // skip self-refs
      const vals = cols.map((c) => valueFor(c, t.name, i, rows));
      out.push(`INSERT INTO ${t.name} (${cols.map((c) => c.name).join(", ")}) VALUES (${vals.join(", ")}) ON CONFLICT DO NOTHING;`);
    }
    const pk = t.columns.find((c) => c.primary && !/uuid|text|char/i.test(c.type));
    if (pk) {
      // explicit ids don't advance serial sequences; resync so later inserts don't collide
      out.push(`SELECT setval(pg_get_serial_sequence('${t.name}', '${pk.name}'), (SELECT max(${pk.name}) FROM ${t.name})) WHERE pg_get_serial_sequence('${t.name}', '${pk.name}') IS NOT NULL;`);
    }
  }
  out.push("COMMIT;");
  return out.join("\n");
}
