import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { WORK_SKILLS } from "@/lib/agent/seed";
import { runTurn } from "@/lib/agent/run";
import type { PermissionMode, WorkMode } from "@/lib/agent/types";
import { useSession, useWork } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PERMISSIONS: { id: PermissionMode; label: string }[] = [
  { id: "default", label: "Ask permissions" },
  { id: "manual", label: "Manual approval" },
  { id: "auto", label: "Fully automatic" },
];

const MODES: { id: WorkMode; label: string }[] = [
  { id: "swarm", label: "Agent Swarm" },
  { id: "plan", label: "Plan" },
  { id: "chat", label: "Agent" },
];

export function Composer({
  autoFocus = false,
  compact = false,
  inputId = "composer",
}: {
  autoFocus?: boolean;
  compact?: boolean;
  inputId?: string;
}) {
  const [draft, setDraft] = useState("");
  const [showSkills, setShowSkills] = useState(false);

  useEffect(() => {
    const take = () => {
      const v = sessionStorage.getItem("codingagent:prefill");
      if (v) {
        sessionStorage.removeItem("codingagent:prefill");
        setDraft(v);
      }
    };
    take();
    window.addEventListener("codingagent:prefill", take);
    return () => window.removeEventListener("codingagent:prefill", take);
  }, []);
  const running = useSession().swarm.running;
  const settings = useWork((s) => s.settings);
  const patch = useWork((s) => s.patchSettings);
  const upsertFile = useWork((s) => s.upsertFile);
  const permission = settings.permission ?? "default";

  const slash = draft.startsWith("/");
  const skillHits = useMemo(() => {
    if (!slash) return [];
    const q = draft.slice(1).toLowerCase();
    return WORK_SKILLS.filter(
      (s) => s.hint.slice(1).startsWith(q) || s.name.toLowerCase().includes(q),
    );
  }, [draft, slash]);

  async function submit(text: string) {
    const v = text.trim();
    if (!v || running) return;
    setDraft("");
    setShowSkills(false);
    await runTurn(v);
  }

  function onPlus() {
    const name = window.prompt("New file path", "notes.md");
    if (!name) return;
    upsertFile(name, "");
  }

  return (
    <form
      className={cn(
        "relative bg-card shadow-[var(--shadow-composer)]",
        compact ? "rounded-lg p-2" : "rounded-xl p-3",
      )}
      onSubmit={(e) => {
        e.preventDefault();
        void submit(draft);
      }}
    >
      {slash && skillHits.length ? (
        <ul className="mb-2 overflow-hidden rounded-md bg-secondary">
          {skillHits.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="flex min-h-10 w-full items-center justify-between px-3 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setDraft(s.prompt);
                  setShowSkills(false);
                }}
              >
                <span>{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label htmlFor={inputId} className="sr-only">
        Describe a job
      </label>
      <textarea
        id={inputId}
        autoFocus={autoFocus}
        suppressHydrationWarning
        value={draft}
        rows={compact ? 2 : 3}
        placeholder={running ? "Working…" : "Describe a job. Type / for skills, @ for files."}
        disabled={running}
        onChange={(e) => {
          setDraft(e.target.value);
          setShowSkills(e.target.value.startsWith("/"));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit(draft);
          }
        }}
        className="w-full resize-none bg-transparent px-2 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 px-1 pt-1">
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Add file" onClick={onPlus}>
          <Plus className="size-4" />
        </Button>
        <label className="sr-only" htmlFor={`${inputId}-permission`}>
          Permissions
        </label>
        <select
          id={`${inputId}-permission`}
          value={permission}
          onChange={(e) => patch({ permission: e.target.value as PermissionMode })}
          className="h-8 rounded-full bg-secondary px-3 text-xs text-foreground"
        >
          {PERMISSIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`${inputId}-agent-mode`}>
          Agent mode
        </label>
        <select
          id={`${inputId}-agent-mode`}
          value={settings.mode}
          onChange={(e) => patch({ mode: e.target.value as WorkMode })}
          className="h-8 rounded-full bg-secondary px-3 text-xs text-foreground"
        >
          {MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {showSkills ? (
          <span className="text-xs text-muted-foreground">Skills via /</span>
        ) : null}
        <Button
          type="submit"
          size="icon"
          variant="ink"
          className="ml-auto rounded-full"
          disabled={running || !draft.trim()}
          aria-label="Send"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </form>
  );
}
