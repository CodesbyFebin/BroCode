import { WORK_SKILLS } from "@/lib/agent/seed";
import { runTurn } from "@/lib/agent/run";
import { BUNDLED_SKILLS } from "@/lib/skills/bundled";

export function SkillsPanel() {
  return (
    <div className="code-scroll h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl tracking-tight">Skills</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Type / in the composer, or run a skill from here.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {WORK_SKILLS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void runTurn(s.prompt)}
              className="rounded-lg bg-card p-5 text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium">{s.name}</h2>
                <span className="font-mono text-xs text-muted-foreground">{s.hint}</span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {s.prompt}
              </p>
            </button>
          ))}
        </div>
        <h2 className="mt-10 font-display text-xl tracking-tight">Agent skills (SKILL.md)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Loaded into every agent prompt. Add a folder under <code>console/skills/</code> to extend.
        </p>
        <ul className="mt-4 grid gap-3">
          {BUNDLED_SKILLS.map((s) => (
            <li key={s.id} className="rounded-lg bg-card p-4 shadow-[var(--shadow-border)]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm">{s.name}</span>
                {s.license ? <span className="text-xs text-muted-foreground">{s.license}</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
