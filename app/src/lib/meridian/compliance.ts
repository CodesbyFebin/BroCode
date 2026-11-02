// Compliance agent: deterministic GDPR / HIPAA / SOC 2 heuristics over code + schema. Evidence, not legal advice.
import type { ComplianceOut, Control } from "./contracts";
import type { SecurityOut } from "./contracts";

const PII = /\b(email|phone|mobile|dob|date_of_birth|birth_?date|address|ssn|aadhaar|pan_number|passport|ip_address|full_name)\b/i;
const PHI = /\b(diagnos\w*|patient\w*|medical_record|mrn|prescription\w*|icd10|lab_result\w*|treatment\w*)\b/i;

export function checkCompliance(files: Record<string, string>, security: SecurityOut, migrationSql = ""): ComplianceOut {
  const all = Object.entries(files);
  const text = all.map(([p, c]) => `${p}\n${c}`).join("\n") + "\n" + migrationSql;
  const hit = (re: RegExp) => all.filter(([, c]) => re.test(c)).map(([p]) => p);
  const piiFiles = hit(PII);
  const hasPii = piiFiles.length > 0 || PII.test(migrationSql);
  const phiFiles = hit(PHI);
  const hasPhi = phiFiles.length > 0 || PHI.test(migrationSql);
  const logsPii = all.filter(([, c]) => /console\.(log|info|debug)\([^)]*\b(email|password|phone|ssn|aadhaar|token)\b/i.test(c) || /\b(print|logger\.\w+)\([^)]*\b(email|password|phone|ssn)\b/i.test(c)).map(([p]) => p);
  const deletion = /\b(delete|erase|forget|anonymi[sz]e|purge)\w*\b[\s\S]{0,80}\b(user|account|customer|profile|patient)/i.test(text);
  const retention = /\bretention|ttl|expires_at|delete_after|purge/i.test(text);
  const consent = /\bconsent/i.test(text);
  const audit = /\baudit[_ ]?log|auditLog|audit_trail/i.test(text);
  const encryption = /\b(pgcrypto|encrypt|kms|aes-256|bcrypt|argon2|scrypt)\b/i.test(text);
  const secrets = security.findings.filter((f) => f.owasp.startsWith("A02") && f.severity === "critical");
  const ci = all.some(([p]) => p.startsWith(".github/workflows/"));
  const C = (framework: Control["framework"], control: string, status: Control["status"], evidence: string): Control => ({ framework, control, status, evidence });

  const controls: Control[] = [
    C("GDPR", "Art. 5/25: no personal data in logs", logsPii.length ? "fail" : "pass", logsPii.length ? `PII logged in ${logsPii.join(", ")}` : "No logging of PII-named fields found"),
    C("GDPR", "Art. 17: right to erasure path", !hasPii ? "n/a" : deletion ? "pass" : "fail", !hasPii ? "No PII-named fields detected" : deletion ? "Deletion/anonymisation code found" : `PII in ${piiFiles.slice(0, 4).join(", ") || "schema"} but no delete/anonymise path`),
    C("GDPR", "Art. 5(1)(e): storage limitation / retention", !hasPii ? "n/a" : retention ? "pass" : "fail", retention ? "Retention/TTL logic found" : "No retention or TTL found for PII"),
    C("GDPR", "Art. 6/7: consent recorded", !hasPii ? "n/a" : consent ? "pass" : "fail", consent ? "Consent field/logic found" : "No consent capture found"),
    C("HIPAA", "§164.312(a)(2)(iv): encryption of ePHI", !hasPhi ? "n/a" : encryption ? "pass" : "fail", !hasPhi ? "No PHI-named fields detected" : encryption ? "Encryption/hash primitives found" : `PHI terms in ${phiFiles.slice(0, 4).join(", ") || "schema"} with no encryption`),
    C("HIPAA", "§164.312(b): audit controls", !hasPhi ? "n/a" : audit ? "pass" : "fail", audit ? "Audit log found" : "No audit logging for PHI access"),
    C("SOC2", "CC6.1: no secrets in source", secrets.length ? "fail" : "pass", secrets.length ? secrets.map((s) => `${s.file}:${s.line} ${s.message}`).join("; ") : "Security scan found no committed secrets"),
    C("SOC2", "CC8.1: changes go through automated CI", ci ? "pass" : "fail", ci ? "Workflow present" : "No .github/workflows yet (Pipeline agent generates one)"),
    C("SOC2", "CC7.2: security findings triaged", security.blocking ? "fail" : "pass", `${security.findings.length} findings, blocking=${security.blocking}`),
  ];
  return { controls, failing: controls.filter((c) => c.status === "fail").length };
}
