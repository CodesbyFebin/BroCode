// Skills registry: SKILL.md folders (front matter + markdown body), the format used by
// andrej-karpathy-skills (MIT) and many agent tools. Pure, so it runs in tests and on the server.

export type Skill = { id: string; name: string; description: string; license?: string; body: string; source: string };

export function parseSkill(source: string, md: string): Skill | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(md);
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
  }
  if (!meta.name || !meta.description) return null;
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(meta.name)) return null;
  return { id: meta.name, name: meta.name, description: meta.description, license: meta.license, body: m[2].trim(), source };
}

export function buildRegistry(files: Record<string, string>): Skill[] {
  const out = new Map<string, Skill>();
  for (const [path, md] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    if (!/(^|\/)SKILL\.md$/.test(path)) continue;
    const s = parseSkill(path, md);
    if (s && !out.has(s.id)) out.set(s.id, s);
  }
  return [...out.values()];
}

/** Prompt block injected into agent system prompts for the chosen skills (bounded). */
export function skillsPromptBlock(skills: Skill[], ids?: string[], maxChars = 12_000): string {
  const chosen = ids ? skills.filter((s) => ids.includes(s.id)) : skills;
  if (!chosen.length) return "";
  let block = "## Skills\n";
  for (const s of chosen) {
    const part = `\n### ${s.name}\n${s.description}\n\n${s.body}\n`;
    if (block.length + part.length > maxChars) break;
    block += part;
  }
  return block;
}
