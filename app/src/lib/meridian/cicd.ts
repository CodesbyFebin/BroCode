// Pipeline agent: generate a GitHub Actions workflow from the detected stack.
import type { PipelineOut } from "./contracts";

export function generateWorkflow(files: Record<string, string>): PipelineOut {
  const jobs: string[] = [];
  const blocks: string[] = [];
  const pkgPath = Object.keys(files).filter((p) => p.endsWith("package.json") && !p.includes("node_modules")).sort((a, b) => a.length - b.length)[0];
  if (pkgPath) {
    let scripts: Record<string, string> = {};
    try { scripts = JSON.parse(files[pkgPath]!).scripts ?? {}; } catch { /* invalid package.json */ }
    const dir = pkgPath.includes("/") ? pkgPath.slice(0, pkgPath.lastIndexOf("/")) : ".";
    const lock = files[`${dir === "." ? "" : dir + "/"}package-lock.json`] != null;
    const steps = [
      "      - uses: actions/checkout@v4",
      "      - uses: actions/setup-node@v4",
      "        with:",
      "          node-version: 22",
      ...(lock ? ["          cache: npm", `          cache-dependency-path: ${dir === "." ? "" : dir + "/"}package-lock.json`] : []),
      `      - run: ${lock ? "npm ci" : "npm install --no-audit --no-fund"}`,
      ...["lint", "typecheck", "test", "build"].filter((s) => scripts[s]).map((s) => `      - run: npm run ${s}${s === "test" ? " --if-present" : ""}`),
      "      - run: npm audit --audit-level=high --omit=dev",
    ];
    jobs.push("node");
    blocks.push(["  node:", "    runs-on: ubuntu-latest", ...(dir !== "." ? ["    defaults:", "      run:", `        working-directory: ${dir}`] : []), "    steps:", ...steps].join("\n"));
  }
  const py = Object.keys(files).find((p) => /(^|\/)(requirements\.txt|pyproject\.toml)$/.test(p));
  if (py) {
    jobs.push("python");
    const req = py.endsWith("requirements.txt") ? `pip install -r ${py}` : "pip install -e .";
    blocks.push(["  python:", "    runs-on: ubuntu-latest", "    steps:", "      - uses: actions/checkout@v4", "      - uses: actions/setup-python@v5", "        with:", "          python-version: '3.12'", `      - run: pip install pytest pip-audit && ${req}`, "      - run: pytest -q", "      - run: pip-audit"].join("\n"));
  }
  jobs.push("secrets");
  blocks.push(["  secrets:", "    runs-on: ubuntu-latest", "    steps:", "      - uses: actions/checkout@v4", "        with:", "          fetch-depth: 0", "      - uses: gitleaks/gitleaks-action@v2", "        env:", "          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}"].join("\n"));
  const yaml = ["name: CI", "", "on:", "  push:", "    branches: [main]", "  pull_request:", "", "permissions:", "  contents: read", "", "jobs:", blocks.join("\n\n"), ""].join("\n");
  return { path: ".github/workflows/ci.yml", yaml, jobs };
}
