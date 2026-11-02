import { test } from "node:test";
import assert from "node:assert/strict";
import { auditMigration, gate, generateRollback, verdictFor } from "../src/lib/pipeline/audit";
import { blueprintFromSql, topoSort, blueprintToSql } from "../src/lib/pipeline/blueprint";
import { seedSql } from "../src/lib/pipeline/datasmith";
import { inferSmokeChecks, runSmoke } from "../src/lib/pipeline/smoke";
import { deployDecision } from "../src/lib/pipeline/deployer";
import { SAFE_MIGRATION, DANGEROUS_MIGRATION } from "../src/lib/pipeline/demo";

test("scorer: safe demo migration scores 10 SAFE", () => {
  const a = auditMigration(SAFE_MIGRATION);
  assert.equal(a.score, 10, JSON.stringify(a.findings));
  assert.equal(a.verdict, "SAFE");
});

test("scorer: each rule applies its penalty", () => {
  const wrap = (s: string) => `BEGIN; ${s}; COMMIT;`;
  assert.equal(auditMigration(wrap("DROP TABLE x")).score, 7);
  assert.equal(auditMigration(wrap("ALTER TABLE t DROP COLUMN c")).score, 7);
  assert.equal(auditMigration(wrap("ALTER TABLE t ADD COLUMN c text NOT NULL")).score, 8);
  assert.equal(auditMigration(wrap("ALTER TABLE t ADD COLUMN c text NOT NULL DEFAULT 'x'")).score, 10);
  assert.equal(auditMigration(wrap("CREATE TABLE a (id int PRIMARY KEY)")).score, 9);
  assert.equal(auditMigration(wrap("CREATE TABLE IF NOT EXISTS b (id int PRIMARY KEY, a_id int REFERENCES a(id))")).score, 9);
  assert.equal(auditMigration("CREATE TABLE IF NOT EXISTS a (id int PRIMARY KEY)").score, 9);
});

test("scorer: dangerous demo migration clamps to 1 and is DO NOT DEPLOY", () => {
  const a = auditMigration(DANGEROUS_MIGRATION);
  assert.equal(a.score, 1);
  assert.equal(a.verdict, "DO NOT DEPLOY");
  assert.ok(a.findings.some((f) => f.rule.includes("payments.order_id")));
});

test("gate blocks 1-4 and passes 5+", () => {
  for (const s of [1, 2, 3, 4]) assert.equal(gate(s).blocked, true);
  for (const s of [5, 7, 10]) assert.equal(gate(s).blocked, false);
  assert.equal(verdictFor(5), "CAUTION");
  assert.equal(verdictFor(8), "SAFE");
});

test("rollback reverses creates and flags irreversible drops", () => {
  const r = generateRollback(SAFE_MIGRATION).split("\n");
  assert.deepEqual(r, ["BEGIN;", "DROP INDEX IF EXISTS idx_orders_customer_id;", "DROP TABLE IF EXISTS orders;", "DROP TABLE IF EXISTS customers;", "COMMIT;"]);
  const d = generateRollback(DANGEROUS_MIGRATION);
  assert.match(d, /DROP TABLE IF EXISTS payments/);
  assert.match(d, /IRREVERSIBLE: DROP TABLE audit_log/);
  assert.match(d, /ALTER TABLE orders DROP COLUMN IF EXISTS gst_number/);
  assert.match(d, /IRREVERSIBLE: customers DROP COLUMN email/);
});

test("topoSort puts parents before children and detects cycles", () => {
  const t = (name: string, ...refs: string[]) => ({ name, columns: [{ name: "id", type: "int", primary: true }, ...refs.map((r) => ({ name: `${r}_id`, type: "int", references: { table: r, column: "id" } }))] });
  const order = topoSort([t("line_items", "orders", "products"), t("orders", "users"), t("products"), t("users"), t("tree", "tree")]);
  assert.ok(order.indexOf("users") < order.indexOf("orders"));
  assert.ok(order.indexOf("orders") < order.indexOf("line_items"));
  assert.ok(order.indexOf("products") < order.indexOf("line_items"));
  assert.throws(() => topoSort([t("a", "b"), t("b", "a")]), /cycle/);
});

test("blueprint -> SQL is itself a SAFE migration", () => {
  const bp = blueprintFromSql(SAFE_MIGRATION, "shop");
  assert.deepEqual(bp.insertOrder, ["customers", "orders"]);
  assert.equal(auditMigration(blueprintToSql(bp)).score, 10);
});

test("seed + smoke run end-to-end on PGlite", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const bp = blueprintFromSql(SAFE_MIGRATION, "shop");
  await db.exec(SAFE_MIGRATION);
  const seed = seedSql(bp);
  assert.match(seed, /ON CONFLICT DO NOTHING/);
  await db.exec(seed);
  await db.exec(seed); // idempotent
  const n = await db.query<{ n: number }>("select count(*)::int n from orders");
  assert.equal(n.rows[0]!.n, 3);
  const r = await runSmoke(db, inferSmokeChecks(bp));
  assert.ok(r.every((x) => x.ok), JSON.stringify(r));
  await db.close();
});

test("deployer refuses DO NOT DEPLOY and requires confirmation", () => {
  assert.equal(deployDecision({ verdict: "DO NOT DEPLOY", confirm: "DEPLOY", smokeOk: true }).allowed, false);
  assert.equal(deployDecision({ verdict: "SAFE", confirm: "yes", smokeOk: true }).allowed, false);
  assert.equal(deployDecision({ verdict: "SAFE", confirm: "DEPLOY", smokeOk: false }).allowed, false);
  assert.equal(deployDecision({ verdict: "CAUTION", confirm: "DEPLOY", smokeOk: true }).allowed, true);
});
