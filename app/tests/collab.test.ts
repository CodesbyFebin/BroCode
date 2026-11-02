import { test } from "node:test";
import assert from "node:assert/strict";
import { collaborationEventInputSchema } from "../src/lib/collab/vendor/ensemble-collaboration";
import { implementAndReview, parseVerdict, participant, ready, runHandoff } from "../src/lib/collab/handoff";

const team = [participant("builder", "implementer"), participant("reviewer", "reviewer")];

test("vendored Ensemble schema works under zod v4", () => {
  const ok = collaborationEventInputSchema.safeParse({ id: "e", runId: "r", type: "t", source: "platform", data: { a: 1 }, createdAt: "now" });
  assert.equal(ok.success, true);
  assert.equal(team[1].permissions.workspace?.access, "read-only");
  assert.equal(parseVerdict("APPROVE\nlooks good"), "approve");
  assert.equal(parseVerdict("REQUEST_CHANGES: approve later"), "changes");
  assert.deepEqual(ready(implementAndReview("x")).map((t) => t.id), ["implement"]);
});

test("implement → review approves first round; reviewer is read-only and sees upstream", async () => {
  const seen: string[] = [];
  const r = await runHandoff(team, implementAndReview("add login"), async ({ participant: p, upstream, readOnly }) => {
    seen.push(`${p.id}:${readOnly}`);
    if (p.id === "builder") return "diff-1";
    assert.equal(upstream.implement, "diff-1");
    return "APPROVE";
  });
  assert.equal(r.status, "completed");
  assert.deepEqual(seen, ["builder:false", "reviewer:true"]);
});

test("request-changes loops feedback back to implementer, then fails at maxRounds", async () => {
  let n = 0;
  const r = await runHandoff(team, implementAndReview("fix bug"), async ({ participant: p, task }) => {
    if (p.id === "builder") return `diff-${++n}${task.prompt.includes("Reviewer feedback") ? "+fb" : ""}`;
    return n < 2 ? "REQUEST_CHANGES\nmissing test" : "APPROVE";
  });
  assert.equal(r.status, "completed");
  assert.equal(r.rounds, 2);
  assert.deepEqual(r.log.map((l) => l.output), ["diff-1", "REQUEST_CHANGES\nmissing test", "diff-2+fb", "APPROVE"]);
  const stuck = await runHandoff(team, implementAndReview("y"), async ({ participant: p }) => (p.id === "builder" ? "d" : "REQUEST_CHANGES"), { maxRounds: 2 });
  assert.equal(stuck.status, "failed");
  assert.equal(stuck.log.length, 4);
  await assert.rejects(runHandoff(team, [{ ...implementAndReview("z")[0], participantId: "ghost" }], async () => ""));
});
