import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { dnaPrompt, extractDNA, type ProjectDNA } from "./dna";

/** Grounding text for the current server request; nebiusChat prepends it to the system prompt. */
const als = new AsyncLocalStorage<{ grounding: string | null }>();
const memory = new Map<string, ProjectDNA>();

export const DEFAULT_PROJECT = "workspace";
const dir = () => process.env.PCM_DNA_DIR || path.join(process.cwd(), ".pcm-dna");
const safeId = (id: string) => (id || DEFAULT_PROJECT).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);

export function currentGrounding(): string | null {
  return als.getStore()?.grounding ?? null;
}

export async function saveDNA(projectId: string, dna: ProjectDNA): Promise<void> {
  const id = safeId(projectId);
  memory.set(id, dna);
  try {
    await mkdir(dir(), { recursive: true });
    await writeFile(path.join(dir(), `${id}.json`), JSON.stringify(dna, null, 2));
  } catch { /* read-only FS (serverless): keep in memory */ }
}

export async function loadDNA(projectId = DEFAULT_PROJECT): Promise<ProjectDNA | null> {
  const id = safeId(projectId);
  if (memory.has(id)) return memory.get(id)!;
  try {
    const d = JSON.parse(await readFile(path.join(dir(), `${id}.json`), "utf8")) as ProjectDNA;
    memory.set(id, d);
    return d;
  } catch {
    return null;
  }
}

export async function listDNA(): Promise<string[]> {
  const ids = new Set(memory.keys());
  try {
    for (const f of await readdir(dir())) if (f.endsWith(".json")) ids.add(f.slice(0, -5));
  } catch { /* none */ }
  return [...ids];
}

/**
 * Passive extraction: called at the start of server functions that receive the
 * workspace. Re-extracts (cheap, deterministic), persists when the fingerprint
 * changed, and grounds every Nemotron call for the rest of this request.
 */
export async function enterGrounding(files: Record<string, string> | undefined, projectId = DEFAULT_PROJECT): Promise<ProjectDNA | null> {
  if (process.env.PCM_DNA === "off") return null;
  // enterWith must run in the synchronous prefix (before any await) so the
  // store attaches to the caller's async context; we fill it in afterwards.
  const store: { grounding: string | null } = { grounding: null };
  als.enterWith(store);
  let dna: ProjectDNA | null = null;
  if (files && Object.keys(files).length) {
    dna = extractDNA(files);
    const prev = await loadDNA(projectId);
    if (!prev || prev.fingerprint !== dna.fingerprint) await saveDNA(projectId, dna);
    else dna = prev;
  } else {
    dna = await loadDNA(projectId);
  }
  if (dna) store.grounding = dnaPrompt(dna);
  return dna;
}
