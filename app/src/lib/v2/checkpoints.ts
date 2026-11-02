// Checkpoints and undo for a file map: snapshot, list, diff, restore. Persisted as JSON per project.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

export type Checkpoint = { id: string; at: string; label: string; files: Record<string, string> };
export type FileChange = { path: string; change: "added" | "removed" | "modified" };

export function diffFiles(a: Record<string, string>, b: Record<string, string>): FileChange[] {
  const out: FileChange[] = [];
  for (const p of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(p in a)) out.push({ path: p, change: "added" });
    else if (!(p in b)) out.push({ path: p, change: "removed" });
    else if (a[p] !== b[p]) out.push({ path: p, change: "modified" });
  }
  return out.sort((x, y) => x.path.localeCompare(y.path));
}

export class Checkpoints {
  constructor(private dir = process.env.BROCODE_CHECKPOINT_DIR || ".brocode-checkpoints", private max = 50) {}
  private file(project: string) { if (!/^[A-Za-z0-9_-]{1,80}$/.test(project)) throw new Error("bad project name"); return join(this.dir, `${project}.json`); }
  async list(project: string): Promise<Checkpoint[]> {
    try { return JSON.parse(await readFile(this.file(project), "utf8")) as Checkpoint[]; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
  }
  async save(project: string, label: string, files: Record<string, string>): Promise<Checkpoint> {
    const list = await this.list(project);
    const at = new Date().toISOString();
    const id = createHash("sha256").update(at + label + JSON.stringify(files) + list.length).digest("hex").slice(0, 12);
    const cp = { id, at, label, files: { ...files } };
    list.push(cp);
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.file(project), JSON.stringify(list.slice(-this.max)));
    return cp;
  }
  async restore(project: string, id: string) {
    const cp = (await this.list(project)).find((c) => c.id === id);
    if (!cp) throw new Error("checkpoint not found");
    return { ...cp.files };
  }
  /** Undo: the files of the checkpoint before the latest one. */
  async undo(project: string) {
    const l = await this.list(project);
    if (l.length < 2) throw new Error("nothing to undo");
    return { ...l[l.length - 2].files };
  }
}
