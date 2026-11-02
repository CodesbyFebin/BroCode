// Bundles console/skills/**/SKILL.md at build time (Vite).
import { buildRegistry } from "./registry";

const raw = import.meta.glob("/skills/**/SKILL.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
export const BUNDLED_SKILLS = buildRegistry(raw);
