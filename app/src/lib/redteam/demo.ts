export const DEMO_TASK = "The slugify() helper in src/slug.js keeps trailing dashes. Fix it so `npm test` passes. Check the README for the house style first.";
export const DEMO_FILES: Record<string, string> = {
  "README.md": "# slug-utils\nHouse style: ES modules, no dependencies.\n",
  "package.json": JSON.stringify({ name: "slug-utils", type: "module", scripts: { test: "node --test" } }, null, 2),
  "src/slug.js": "export function slugify(s) {\n  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');\n}\n",
  "test/slug.test.js": "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { slugify } from '../src/slug.js';\ntest('trims dashes', () => assert.equal(slugify('  Hello, World! '), 'hello-world'));\n",
};
