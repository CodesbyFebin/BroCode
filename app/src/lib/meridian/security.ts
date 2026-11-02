// Security agent: deterministic OWASP-style static scan. Nemotron may add notes, but findings come from rules.
import type { SecurityFinding, SecurityOut, Severity } from "./contracts";

type Rule = { id: string; owasp: string; severity: Severity; re: RegExp; message: string; skipTests?: boolean };

export const SECURITY_RULES: Rule[] = [
  { id: "secret-aws", owasp: "A02 Cryptographic Failures", severity: "critical", re: /AKIA[0-9A-Z]{16}/, message: "AWS access key committed" },
  { id: "secret-key", owasp: "A02 Cryptographic Failures", severity: "critical", re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, message: "Private key committed" },
  { id: "secret-token", owasp: "A02 Cryptographic Failures", severity: "critical", re: /\b(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{30,}|xox[bp]-[A-Za-z0-9-]{20,})/, message: "API token committed" },
  { id: "hardcoded-password", owasp: "A07 Identification and Authentication Failures", severity: "high", re: /\b(password|passwd|secret|api_?key)\s*[:=]\s*["'][^"'\s]{6,}["']/i, message: "Hard-coded credential", skipTests: true },
  { id: "eval", owasp: "A03 Injection", severity: "high", re: /\beval\s*\(|new\s+Function\s*\(/, message: "Dynamic code execution (eval / new Function)" },
  { id: "cmd-injection", owasp: "A03 Injection", severity: "high", re: /\b(exec|execSync)\s*\(\s*`[^`]*\$\{|os\.system\(|subprocess\.\w+\([^)]*shell\s*=\s*True/, message: "Shell command built from interpolated input" },
  { id: "sql-injection", owasp: "A03 Injection", severity: "high", re: /\b(query|execute|raw)\s*\(\s*(`[^`]*\$\{|["'][^"']*(select|insert|update|delete)[^"']*["']\s*\+)/i, message: "SQL built by string interpolation" },
  { id: "xss", owasp: "A03 Injection", severity: "medium", re: /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\(/, message: "Unescaped HTML sink (XSS)" },
  { id: "weak-hash", owasp: "A02 Cryptographic Failures", severity: "medium", re: /createHash\(\s*["'](md5|sha1)["']|hashlib\.(md5|sha1)\(/, message: "Weak hash algorithm" },
  { id: "insecure-random", owasp: "A02 Cryptographic Failures", severity: "medium", re: /(token|secret|session|otp|nonce)\w*\s*=\s*Math\.random\(/i, message: "Math.random used for a security token" },
  { id: "tls-off", owasp: "A05 Security Misconfiguration", severity: "high", re: /rejectUnauthorized\s*:\s*false|verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/, message: "TLS verification disabled" },
  { id: "cors-any", owasp: "A05 Security Misconfiguration", severity: "medium", re: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']|origin\s*:\s*["']\*["']/, message: "CORS allows any origin" },
  { id: "plain-http", owasp: "A02 Cryptographic Failures", severity: "low", re: /["']http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[\w.-]+/, message: "Plain-HTTP URL" },
  { id: "ssrf", owasp: "A10 Server-Side Request Forgery", severity: "medium", re: /fetch\(\s*(req\.(query|body|params)|request\.(args|json))/, message: "Fetching a URL taken directly from the request" },
];

const isTest = (p: string) => /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[jt]sx?$|_test\.py$/.test(p);
const SCANNABLE = /\.(m?[jt]sx?|cjs|py|rb|go|java|php|env|ya?ml|json|toml|sh)$|(^|\/)\.env/;

export function scanSecurity(files: Record<string, string>): SecurityOut {
  const findings: SecurityFinding[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!SCANNABLE.test(path) || /package-lock\.json$/.test(path)) continue;
    const lines = content.split("\n");
    lines.forEach((line, i) => {
      for (const r of SECURITY_RULES) {
        if (r.skipTests && isTest(path)) continue;
        if (r.re.test(line)) findings.push({ id: r.id, owasp: r.owasp, severity: r.severity, file: path, line: i + 1, message: r.message, snippet: line.trim().slice(0, 160) });
      }
    });
    if (/(^|\/)\.env(\.|$)/.test(path) && !/\.example$/.test(path) && /=\s*\S/.test(content)) {
      findings.push({ id: "env-file", owasp: "A05 Security Misconfiguration", severity: "high", file: path, line: 1, message: ".env file with values in the workspace", snippet: "" });
    }
  }
  return { findings, blocking: findings.some((f) => f.severity === "critical" || f.severity === "high") };
}
