// Persistence for RedAgent sessions, mutations, bugs and hypotheses (PGlite or pg-compatible runner).
import type { AttackClass, Bug, Mutation } from "./types";

export type Db = {
  exec: (sql: string) => Promise<unknown>;
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS redagent_sessions (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), task text NOT NULL, model text, mutations int NOT NULL DEFAULT 0, bugs int NOT NULL DEFAULT 0, cost_usd numeric NOT NULL DEFAULT 0, report text);
CREATE TABLE IF NOT EXISTS redagent_mutations (id text NOT NULL, session_id text NOT NULL REFERENCES redagent_sessions(id) ON DELETE CASCADE, seq int NOT NULL, tool text NOT NULL, kind text NOT NULL, attack_class text NOT NULL, canary text NOT NULL, original text, mutated text, rationale text, PRIMARY KEY (session_id, id));
CREATE INDEX IF NOT EXISTS idx_redagent_mutations_session ON redagent_mutations (session_id);
CREATE TABLE IF NOT EXISTS redagent_bugs (session_id text NOT NULL REFERENCES redagent_sessions(id) ON DELETE CASCADE, mutation_id text NOT NULL, attack_class text NOT NULL, severity text NOT NULL, tool text NOT NULL, evidence text, PRIMARY KEY (session_id, mutation_id));
CREATE INDEX IF NOT EXISTS idx_redagent_bugs_session ON redagent_bugs (session_id);
CREATE TABLE IF NOT EXISTS redagent_hypotheses (fingerprint text PRIMARY KEY, attack_class text NOT NULL, tool text NOT NULL, text text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), tested_in text, confirmed boolean NOT NULL DEFAULT false);
`;

export async function migrate(db: Db) {
  await db.exec(SCHEMA);
}

export async function saveSession(db: Db, s: { id: string; task: string; model: string; costUsd: number; report: string; log: Mutation[]; bugs: Bug[] }) {
  await db.query(
    "INSERT INTO redagent_sessions (id, task, model, mutations, bugs, cost_usd, report) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING",
    [s.id, s.task.slice(0, 4000), s.model, s.log.length, s.bugs.length, s.costUsd, s.report],
  );
  for (const m of s.log) {
    await db.query(
      "INSERT INTO redagent_mutations (id, session_id, seq, tool, kind, attack_class, canary, original, mutated, rationale) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING",
      [m.id, s.id, m.seq, m.tool, m.kind, m.attackClass, m.canary, m.original, m.mutated, m.rationale],
    );
  }
  for (const b of s.bugs) {
    await db.query(
      "INSERT INTO redagent_bugs (session_id, mutation_id, attack_class, severity, tool, evidence) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
      [s.id, b.mutationId, b.attackClass, b.severity, b.tool, b.evidence],
    );
  }
  for (const m of s.log) {
    await db.query("UPDATE redagent_hypotheses SET tested_in = $1, confirmed = confirmed OR $2 WHERE attack_class = $3 AND tool = $4 AND tested_in IS NULL", [
      s.id,
      s.bugs.some((b) => b.mutationId === m.id),
      m.attackClass,
      m.tool,
    ]);
  }
}

export async function listSessions(db: Db, limit = 20) {
  const r = await db.query<{ id: string; created_at: string; task: string; mutations: number; bugs: number; cost_usd: string }>(
    "SELECT id, created_at, task, mutations, bugs, cost_usd FROM redagent_sessions ORDER BY created_at DESC LIMIT $1",
    [limit],
  );
  return r.rows;
}

export async function getSession(db: Db, id: string) {
  const s = await db.query<{ id: string; task: string; report: string }>("SELECT id, task, report FROM redagent_sessions WHERE id = $1", [id]);
  const bugs = await db.query<{ severity: string }>("SELECT severity FROM redagent_bugs WHERE session_id = $1", [id]);
  return s.rows[0] ? { ...s.rows[0], severities: bugs.rows.map((b) => b.severity) } : null;
}

export const fingerprint = (attackClass: string, tool: string, text: string) =>
  `${attackClass}|${tool}|${text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 120)}`;

/** Store only hypotheses whose fingerprint has never been seen; returns the novel ones. */
export async function addHypotheses(db: Db, hs: { attackClass: AttackClass; tool: string; text: string }[]) {
  const novel: typeof hs = [];
  for (const h of hs) {
    const r = await db.query("INSERT INTO redagent_hypotheses (fingerprint, attack_class, tool, text) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING fingerprint", [
      fingerprint(h.attackClass, h.tool, h.text),
      h.attackClass,
      h.tool,
      h.text,
    ]);
    if (r.rows.length) novel.push(h);
  }
  return novel;
}

export async function coverage(db: Db) {
  const r = await db.query<{ tool: string; attack_class: string; n: number }>("SELECT tool, attack_class, count(*)::int AS n FROM redagent_mutations GROUP BY 1,2");
  return r.rows;
}

/** Deterministic novelty: tool x attack-class combinations never tried in any past session. */
export function untriedCombos(tools: string[], tried: { tool: string; attack_class: string }[], classes: AttackClass[]) {
  const seen = new Set(tried.map((t) => `${t.tool}|${t.attack_class}`));
  const out: { attackClass: AttackClass; tool: string; text: string }[] = [];
  for (const tool of tools) for (const c of classes) if (!seen.has(`${tool}|${c}`)) out.push({ attackClass: c, tool, text: `Untested: ${c.replace(/_/g, " ")} via ${tool}` });
  return out;
}
