// Shadow previews: isolated in-memory Postgres (PGlite) per preview, torn down after a TTL.
import type { PGlite } from "@electric-sql/pglite";
import type { Verdict } from "./audit";

export type PreviewInfo = {
  id: string;
  createdAt: number;
  expiresAt: number;
  verdict: Verdict;
  score: number;
  smokeOk: boolean;
  tables: string[];
  deployed?: boolean;
};
type Entry = { info: PreviewInfo; db: PGlite; timer: ReturnType<typeof setTimeout> };

const g = globalThis as unknown as { __shadowPreviews__?: Map<string, Entry> };
const registry = (g.__shadowPreviews__ ??= new Map());

export const PREVIEW_TTL_MS = Number(process.env.PREVIEW_TTL_MS || 15 * 60_000);

export async function createPreview(meta: Omit<PreviewInfo, "id" | "createdAt" | "expiresAt" | "smokeOk" | "tables">) {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  const id = `pv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const info: PreviewInfo = { ...meta, id, createdAt: now, expiresAt: now + PREVIEW_TTL_MS, smokeOk: false, tables: [] };
  const timer = setTimeout(() => void teardownPreview(id), PREVIEW_TTL_MS);
  (timer as { unref?: () => void }).unref?.();
  registry.set(id, { info, db, timer });
  return { id, db, info };
}

export function getPreview(id: string): PreviewInfo | null {
  return registry.get(id)?.info ?? null;
}

export function listPreviews(): PreviewInfo[] {
  return [...registry.values()].map((e) => e.info).sort((a, b) => b.createdAt - a.createdAt);
}

export async function teardownPreview(id: string): Promise<boolean> {
  const e = registry.get(id);
  if (!e) return false;
  clearTimeout(e.timer);
  registry.delete(id);
  await e.db.close().catch(() => {});
  return true;
}
