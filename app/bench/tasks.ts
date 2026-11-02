// Small, hidden-test coding tasks. Tests are never shown to the model.
const t = (body: string) => `import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport * as s from "../src/solution.js";\n${body}\n`;

export const TASKS = [
  {
    id: "slugify",
    prompt: "Implement export function slugify(str): lowercase, ASCII letters/digits only, runs of other chars become a single '-', no leading/trailing '-'.",
    test: t(`test("slug", () => { assert.equal(s.slugify("  Hello,  World!! "), "hello-world"); assert.equal(s.slugify("--A__b--"), "a-b"); assert.equal(s.slugify(""), ""); });`),
  },
  {
    id: "inr",
    prompt: "Implement export function formatINR(paise): format an integer number of paise as Indian rupees with Indian digit grouping and 2 decimals, prefixed with '₹'. Negative values get a leading '-' before '₹'.",
    test: t(`test("inr", () => { assert.equal(s.formatINR(12345678), "₹1,23,456.78"); assert.equal(s.formatINR(5), "₹0.05"); assert.equal(s.formatINR(-100000), "-₹1,000.00"); });`),
  },
  {
    id: "lru",
    prompt: "Implement export class LRUCache with constructor(capacity), get(key) returning value or undefined (marks as recently used), set(key, value) evicting least-recently-used when over capacity.",
    test: t(`test("lru", () => { const c = new s.LRUCache(2); c.set("a",1); c.set("b",2); c.get("a"); c.set("c",3); assert.equal(c.get("b"), undefined); assert.equal(c.get("a"), 1); assert.equal(c.get("c"), 3); });`),
  },
  {
    id: "intervals",
    prompt: "Implement export function mergeIntervals(list): given [[start,end],...] (unsorted, inclusive), return merged, sorted, non-overlapping intervals. Touching intervals like [1,2],[2,3] merge.",
    test: t(`test("merge", () => { assert.deepEqual(s.mergeIntervals([[5,6],[1,3],[2,4]]), [[1,4],[5,6]]); assert.deepEqual(s.mergeIntervals([[1,2],[2,3]]), [[1,3]]); assert.deepEqual(s.mergeIntervals([]), []); });`),
  },
  {
    id: "semver",
    prompt: "Implement export function compareSemver(a, b) returning -1, 0 or 1 for versions like '1.2.3' and '1.2.3-beta.1' following SemVer 2.0 precedence (prerelease < release; numeric identifiers compare numerically).",
    test: t(`test("semver", () => { assert.equal(s.compareSemver("1.2.3","1.2.10"), -1); assert.equal(s.compareSemver("1.0.0-beta.2","1.0.0-beta.11"), -1); assert.equal(s.compareSemver("1.0.0","1.0.0-rc.1"), 1); assert.equal(s.compareSemver("2.0.0","2.0.0"), 0); });`),
  },
];
