// Migration Auditor: deterministic penalty score, rollback SQL, deploy gate.
import { ident, norm, splitStatements } from "./sql";

export type Verdict = "SAFE" | "CAUTION" | "DO NOT DEPLOY";
export type Finding = { rule: string; penalty: number; statement: string };
export type AuditResult = { score: number; verdict: Verdict; findings: Finding[]; rollbackSql: string; statements: number };

export const RULES = {
  drop: { rule: "DROP TABLE/COLUMN destroys data", penalty: 3 },
  notNull: { rule: "ADD COLUMN NOT NULL without DEFAULT fails on non-empty tables", penalty: 2 },
  ifNotExists: { rule: "CREATE without IF NOT EXISTS is not idempotent", penalty: 1 },
  fkIndex: { rule: "Foreign key column has no index", penalty: 1 },
  txn: { rule: "Migration is not wrapped in BEGIN/COMMIT", penalty: 1 },
} as const;

export function verdictFor(score: number): Verdict {
  if (score >= 8) return "SAFE";
  if (score >= 5) return "CAUTION";
  return "DO NOT DEPLOY";
}

/** Hard gate: scores 1-4 block the pipeline. */
export function gate(score: number): { blocked: boolean; reason: string } {
  return score <= 4
    ? { blocked: true, reason: `Migration score ${score}/10 is DO NOT DEPLOY; pipeline halted.` }
    : { blocked: false, reason: `Migration score ${score}/10 passes the gate.` };
}

type Fk = { table: string; column: string; stmt: string };

export function auditMigration(sql: string): AuditResult {
  const stmts = splitStatements(sql);
  const findings: Finding[] = [];
  const add = (r: { rule: string; penalty: number }, stmt: string) =>
    findings.push({ ...r, statement: norm(stmt).slice(0, 160) });

  const fks: Fk[] = [];
  const indexed = new Set<string>(); // "table.col"

  for (const s of stmts) {
    const n = norm(s);
    if (/^drop\s+table\b/i.test(n) || /\bdrop\s+column\b/i.test(n)) add(RULES.drop, s);
    const addCols = n.match(/\badd\s+column\b[^,]*/gi) ?? [];
    for (const ac of addCols) {
      if (/\bnot\s+null\b/i.test(ac) && !/\bdefault\b/i.test(ac)) add(RULES.notNull, s);
    }
    if (/^create\s+(unique\s+)?(table|index)\b/i.test(n) && !/\bif\s+not\s+exists\b/i.test(n)) add(RULES.ifNotExists, s);

    const ct = n.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\(([\s\S]*)\)\s*$/i);
    if (ct) {
      const table = ident(ct[1]!);
      for (const col of splitTopLevel(ct[2]!)) {
        const cm = col.trim().match(/^"?(\w+)"?\s+/);
        if (!cm || /^(constraint|primary|foreign|unique|check)$/i.test(cm[1]!)) {
          const tfk = col.match(/foreign\s+key\s*\(\s*"?(\w+)"?\s*\)\s*references/i);
          if (tfk) fks.push({ table, column: tfk[1]!.toLowerCase(), stmt: s });
          const pk = col.match(/(?:primary\s+key|unique)\s*\(\s*"?(\w+)"?/i);
          if (pk) indexed.add(`${table}.${pk[1]!.toLowerCase()}`);
          continue;
        }
        const c = cm[1]!.toLowerCase();
        if (/\breferences\b/i.test(col)) fks.push({ table, column: c, stmt: s });
        if (/\b(primary\s+key|unique)\b/i.test(col)) indexed.add(`${table}.${c}`);
      }
    }
    const at = n.match(/^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)/i);
    if (at) {
      const table = ident(at[1]!);
      for (const m of n.matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?[^,]*?\breferences\b/gi)) {
        fks.push({ table, column: m[1]!.toLowerCase(), stmt: s });
      }
      const afk = n.match(/foreign\s+key\s*\(\s*"?(\w+)"?\s*\)/i);
      if (afk) fks.push({ table, column: afk[1]!.toLowerCase(), stmt: s });
    }
    const ci = n.match(/^create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?[\w"]*\s*on\s+([\w."]+)\s*(?:using\s+\w+\s*)?\(\s*"?(\w+)"?/i);
    if (ci) indexed.add(`${ident(ci[1]!)}.${ci[2]!.toLowerCase()}`);
  }
  for (const fk of fks) {
    if (!indexed.has(`${fk.table}.${fk.column}`)) add({ ...RULES.fkIndex, rule: `${RULES.fkIndex.rule}: ${fk.table}.${fk.column}` }, fk.stmt);
  }
  const hasBegin = stmts.some((s) => /^(begin|start\s+transaction)\b/i.test(norm(s)));
  const hasCommit = stmts.some((s) => /^commit\b/i.test(norm(s)));
  if (!(hasBegin && hasCommit)) findings.push({ ...RULES.txn, statement: "(whole migration)" });

  const score = Math.max(1, Math.min(10, 10 - findings.reduce((a, f) => a + f.penalty, 0)));
  return { score, verdict: verdictFor(score), findings, rollbackSql: generateRollback(sql), statements: stmts.length };
}

export function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts;
}

/** Best-effort inverse migration, in reverse order, inside a transaction. */
export function generateRollback(sql: string): string {
  const out: string[] = [];
  for (const s of splitStatements(sql).reverse()) {
    const n = norm(s);
    let m: RegExpMatchArray | null;
    if ((m = n.match(/^create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)/i))) {
      out.push(`DROP TABLE IF EXISTS ${m[1]};`);
    } else if ((m = n.match(/^create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?("?\w+"?)\s+on/i))) {
      out.push(`DROP INDEX IF EXISTS ${m[1]};`);
    } else if ((m = n.match(/^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+(.*)$/i))) {
      const table = m[1]!;
      const actions = splitTopLevel(m[2]!);
      for (const a of actions.reverse()) {
        const at = a.trim();
        let x: RegExpMatchArray | null;
        if ((x = at.match(/^add\s+column\s+(?:if\s+not\s+exists\s+)?("?\w+"?)/i))) out.push(`ALTER TABLE ${table} DROP COLUMN IF EXISTS ${x[1]};`);
        else if ((x = at.match(/^add\s+constraint\s+("?\w+"?)/i))) out.push(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${x[1]};`);
        else if ((x = at.match(/^rename\s+column\s+("?\w+"?)\s+to\s+("?\w+"?)/i))) out.push(`ALTER TABLE ${table} RENAME COLUMN ${x[2]} TO ${x[1]};`);
        else if (/^drop\s+column/i.test(at)) out.push(`-- IRREVERSIBLE: ${table} ${at} (data lost; restore from backup)`);
        else out.push(`-- MANUAL: cannot invert "${at}" on ${table}`);
      }
    } else if (/^drop\s+table/i.test(n)) {
      out.push(`-- IRREVERSIBLE: ${n} (data lost; restore from backup)`);
    } else if ((m = n.match(/^insert\s+into\s+([\w."]+)/i))) {
      out.push(`-- MANUAL: delete rows inserted into ${m[1]}`);
    } else if (/^(begin|commit|start\s+transaction)\b/i.test(n)) {
      continue;
    } else {
      out.push(`-- MANUAL: cannot invert "${n.slice(0, 80)}"`);
    }
  }
  return ["BEGIN;", ...out, "COMMIT;"].join("\n");
}
