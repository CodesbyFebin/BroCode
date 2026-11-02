import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry, parseSkill, skillsPromptBlock } from "../src/lib/skills/registry";

const dir = join(import.meta.dirname, "..", "skills");
const files = Object.fromEntries(readdirSync(dir).map((d) => [`skills/${d}/SKILL.md`, readFileSync(join(dir, d, "SKILL.md"), "utf8")]));

test("skills: bundled SKILL.md folders all parse, incl. vendored karpathy-guidelines", () => {
  const reg = buildRegistry(files);
  assert.equal(reg.length, Object.keys(files).length);
  const k = reg.find((s) => s.id === "karpathy-guidelines");
  assert.ok(k && k.license === "MIT" && k.body.includes("Think Before Coding"));
});

test("skills: rejects missing front matter and bad names; prompt block is bounded", () => {
  assert.equal(parseSkill("x", "# no front matter"), null);
  assert.equal(parseSkill("x", "---\nname: Bad Name\ndescription: d\n---\nbody"), null);
  const reg = buildRegistry(files);
  const b = skillsPromptBlock(reg, ["verify-before-done"]);
  assert.ok(b.includes("verify-before-done") && !b.includes("Karpathy"));
  assert.ok(skillsPromptBlock(reg, undefined, 200).length <= 200);
});
