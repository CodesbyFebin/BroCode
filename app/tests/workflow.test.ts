import { test } from "node:test";
import assert from "node:assert/strict";
import { EXAMPLE_WORKFLOW, evalCondition, render, validateWorkflow, type Workflow } from "../src/lib/workflow/schema";
import { runWorkflow, type WfDeps } from "../src/lib/workflow/engine";

const deps = (blocking: boolean, exit = 0): WfDeps & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    llm: async (p, tier) => { calls.push(`llm:${tier}:${p}`); return { text: `out(${p})`, model: tier }; },
    tool: async (name) => { calls.push(`tool:${name}`); return JSON.stringify({ blocking }); },
    check: async (cmd) => { calls.push(`check:${cmd}`); return { exitCode: exit, output: "" }; },
  };
};

test("workflow: example validates; cycles, missing branches and bad refs are rejected", () => {
  assert.deepEqual(validateWorkflow(EXAMPLE_WORKFLOW), []);
  const cyc: Workflow = { ...EXAMPLE_WORKFLOW, edges: [...EXAMPLE_WORKFLOW.edges, { from: "end", to: "start" }] };
  assert.ok(validateWorkflow(cyc).includes("workflow has a cycle"));
  const noFalse: Workflow = { ...EXAMPLE_WORKFLOW, edges: EXAMPLE_WORKFLOW.edges.filter((e) => e.when !== "false") };
  assert.ok(validateWorkflow(noFalse).some((e) => e.includes("true and a false edge")));
  const bad: Workflow = { ...EXAMPLE_WORKFLOW, edges: [{ from: "start", to: "ghost" }] };
  assert.ok(validateWorkflow(bad).some((e) => e.includes("missing node")));
});

test("workflow: condition language is safe and exact", () => {
  assert.equal(evalCondition('x contains "ab"', { x: "zabz" }), true);
  assert.equal(evalCondition("n > 3", { n: "4" }), true);
  assert.equal(evalCondition("y empty", {}), true);
  assert.throws(() => evalCondition("process.exit()", {}));
  assert.equal(render("a {{input}} {{nope}}", { input: "b" }), "a b ");
});

test("workflow: clean scan takes the test branch; blocking scan takes the explain branch", async () => {
  const d1 = deps(false);
  const r1 = await runWorkflow(EXAMPLE_WORKFLOW, "add login", {}, d1);
  assert.equal(r1.ok, true);
  assert.ok(d1.calls.includes("check:npm test") && !d1.calls.some((c) => c.startsWith("llm:nano")));
  assert.equal(r1.steps.find((s) => s.node === "explain")!.status, "skipped");
  assert.ok(d1.calls[0] === "llm:ultra:Plan the change for: add login");

  const d2 = deps(true);
  const r2 = await runWorkflow(EXAMPLE_WORKFLOW, "x", {}, d2);
  assert.ok(d2.calls.some((c) => c.startsWith("llm:nano")) && !d2.calls.includes("check:npm test"));
  assert.equal(r2.steps.find((s) => s.node === "test")!.status, "skipped");
});

test("workflow: failing check stops the run and reports failure", async () => {
  const r = await runWorkflow(EXAMPLE_WORKFLOW, "x", {}, deps(false, 1));
  assert.equal(r.ok, false);
  assert.equal(r.steps.at(-1)!.node, "test");
  assert.equal(r.vars.test_exit, "1");
});
