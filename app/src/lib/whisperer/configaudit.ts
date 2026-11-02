import { scanSecurity } from "../meridian/security";

export type ConfigFinding = { file: string; line: number | null; severity: "critical" | "high" | "medium" | "low"; rule: string; message: string };

const lineOf = (content: string, idx: number) => content.slice(0, idx).split("\n").length;

/**
 * Unsafe-config audit run on merge: GitHub Actions workflow risks, Dockerfiles,
 * committed env files, and the Security agent's OWASP rules across the tree.
 */
export function auditConfig(files: Record<string, string>): { findings: ConfigFinding[]; blocking: boolean } {
  const findings: ConfigFinding[] = [];
  const add = (file: string, content: string, re: RegExp, severity: ConfigFinding["severity"], rule: string, message: string) => {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (const m of content.matchAll(g)) findings.push({ file, line: lineOf(content, m.index ?? 0), severity, rule, message });
  };
  for (const [p, c] of Object.entries(files)) {
    if (/^\.github\/workflows\/.+\.ya?ml$/.test(p)) {
      if (/pull_request_target/.test(c) && /ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.(sha|ref)/.test(c)) add(p, c, /pull_request_target/, "critical", "gha-pwn-request", "pull_request_target checks out untrusted PR code with a write token");
      add(p, c, /run:.*\$\{\{\s*github\.event\.(issue|pull_request|comment|review|head_commit)\.[\w.]*(title|body|message|name|ref)\s*\}\}/, "high", "gha-script-injection", "Untrusted event text interpolated into a shell `run:` — pass it via env instead");
      add(p, c, /permissions:\s*write-all/, "high", "gha-write-all", "Workflow grants write-all permissions");
      if (!/^\s*permissions:/m.test(c)) findings.push({ file: p, line: null, severity: "medium", rule: "gha-no-permissions", message: "No `permissions:` block — the token gets the repo default (often write)" });
      add(p, c, /uses:\s*[\w.-]+\/[\w.-]+@(master|main|latest)\b/, "medium", "gha-unpinned-action", "Third-party action pinned to a moving branch");
      add(p, c, /echo\s+.*\$\{\{\s*secrets\./, "high", "gha-secret-echo", "Secret echoed to the log");
      add(p, c, /ACTIONS_ALLOW_UNSECURE_COMMANDS:\s*['"]?true/, "high", "gha-unsecure-commands", "Deprecated unsecure workflow commands enabled");
    }
    if (/(^|\/)Dockerfile[^/]*$/.test(p)) {
      add(p, c, /^FROM\s+\S+:latest\b|^FROM\s+[^\s:@]+\s*$/m, "medium", "docker-unpinned-base", "Base image not pinned to a version/digest");
      if (!/^USER\s+(?!root\b)\S+/m.test(c)) findings.push({ file: p, line: null, severity: "medium", rule: "docker-root", message: "Container runs as root (no non-root USER)" });
      add(p, c, /^(ENV|ARG)\s+\w*(SECRET|TOKEN|PASSWORD|API_KEY)\w*[= ]\S+/m, "high", "docker-baked-secret", "Secret baked into the image layer");
    }
    // Idea credit: adeshukla/devstash CI checks that .env.example holds no real secrets.
    if (/(^|\/)\.env\.(example|sample|template)$/.test(p)) {
      add(p, c, /^\s*[A-Z0-9_]*(KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*=\s*(?!(?:your|change|replace|example|placeholder|dummy|test|sample|xxx|<)|\s*$|#)[A-Za-z0-9_\-./+]{16,}/im, "high", "env-example-real-secret", "Example env file appears to contain a real secret value");
    }
    if (/(^|\/)vercel\.json$|netlify\.toml$/.test(p)) add(p, c, /Access-Control-Allow-Origin["'\s:=]+\*/, "medium", "cors-wildcard", "Wildcard CORS header in deploy config");
    if (/(^|\/)tsconfig\.json$/.test(p)) add(p, c, /"strict"\s*:\s*false/, "low", "ts-not-strict", "TypeScript strict mode disabled");
  }
  for (const s of scanSecurity(files).findings) findings.push({ file: s.file, line: s.line, severity: s.severity, rule: s.id, message: `${s.owasp}: ${s.message}` });
  return { findings, blocking: findings.some((f) => f.severity === "critical" || f.severity === "high") };
}
