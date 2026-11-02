// Persistent per-project agent memory: JSONL file per project, keyword-scored recall.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type Memory = { at: string; kind: "fact" | "decision" | "preference" | "error"; text: string; tags: string[] };
const safe = (p: string) => { if (!/^[A-Za-z0-9._-]{1,80}$/.test(p) || p.startsWith(".")) throw new Error("bad project name"); return p; };
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9_]{3,}/g) ?? []);

export class MemoryStore {
  constructor(private dir = process.env.BROCODE_MEMORY_DIR || ".brocode-memory") {}
  private file(project: string) { return join(this.dir, `${safe(project)}.jsonl`); }
  async remember(project: string, m: Omit<Memory, "at"> & { at?: string }) {
    await mkdir(this.dir, { recursive: true });
    const rec: Memory = { at: m.at ?? new Date().toISOString(), kind: m.kind, text: m.text, tags: m.tags };
    await appendFile(this.file(project), JSON.stringify(rec) + "\n");
    return rec;
  }
  async all(project: string): Promise<Memory[]> {
    try { return (await readFile(this.file(project), "utf8")).split("\n").filter(Boolean).map((l) => JSON.parse(l) as Memory); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
  }
  async recall(project: string, query: string, k = 5): Promise<Memory[]> {
    const q = words(query);
    return (await this.all(project))
      .map((m, i) => ({ m, i, s: [...words(m.text + " " + m.tags.join(" "))].filter((w) => q.has(w)).length }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || b.i - a.i).slice(0, k).map((x) => x.m);
  }
  /** Prompt block for grounding an agent call. */
  async context(project: string, query: string) {
    const r = await this.recall(project, query);
    return r.length ? `Project memory:\n${r.map((m) => `- [${m.kind}] ${m.text}`).join("\n")}` : "";
  }
}
