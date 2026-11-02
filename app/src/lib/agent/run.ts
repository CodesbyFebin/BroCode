import { toast } from "sonner";
import { routeCompletion } from "@/lib/agent/gateway";
import { parseSwarmPayload } from "@/lib/agent/parse";
import { AGENTS, fallbackRoute, providerById, resolveRoute } from "@/lib/agent/providers";
import { buildSystemPrompt, maxTokensFor } from "@/lib/agent/prompts";
import { idleSwarm, queuedSwarm } from "@/lib/agent/swarm";
import { useWork } from "@/lib/store";
import { safePath, uid } from "@/lib/utils";
import type { ChatMessage, FileChange, SwarmAgent, TraceStep, VerificationResult } from "@/lib/agent/types";
import { research, researchContext, type Citation } from "@/lib/agent/tavily";
import { runVerifyLoop } from "@/lib/agent/verify";
import { NEMOTRON } from "@/lib/agent/nebius";
import { BUNDLED_SKILLS } from "@/lib/skills/bundled";
import { skillsPromptBlock } from "@/lib/skills/registry";

export async function runTurn(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const store = useWork.getState();
  const session = store.current();
  if (session.swarm.running) {
    toast("A swarm is already running");
    return;
  }

  const userMsg: ChatMessage = {
    id: uid(),
    role: "user",
    content: trimmed.slice(0, 4000),
    createdAt: Date.now(),
  };

  store.patchCurrent((s) => ({
    ...s,
    messages: [...s.messages, userMsg],
    swarm: queuedSwarm(),
  }));
  store.setActivity("files");
  store.setMobileTab("task");

  const tick = window.setInterval(() => {
    const cur = useWork.getState().current();
    if (!cur.swarm.running) return;
    const agents = cur.swarm.agents.map((a, i, arr) => {
      const thinkingIdx = arr.findIndex((x) => x.status === "thinking");
      if (a.status === "queued" && i === thinkingIdx + 1 && Math.random() > 0.45) {
        return { ...a, status: "thinking" as const, startedAt: Date.now() };
      }
      return a;
    });
    useWork.getState().setSwarm({ ...cur.swarm, agents });
  }, 700);

  try {
    const settings = useWork.getState().settings;
    const live = useWork.getState().current();
    const route =
      settings.mode === "chat"
        ? fallbackRoute(settings)
        : resolveRoute("orchestrator", settings);
    const provider = providerById(route.providerId);
    const apiKey = provider?.builtIn ? undefined : settings.keys[route.providerId]?.trim();

    const history = live.messages.slice(-8).map((m) => ({
      role: m.role === "system" ? ("system" as const) : m.role,
      content: m.content,
    }));

    const trace: TraceStep[] = [];
    let citations: Citation[] = [];
    let webContext = "";
    if (settings.mode !== "chat") {
      // Researcher tool: Tavily web search (no-op server-side if TAVILY_API_KEY is unset).
      const r = await research({ data: { query: trimmed.slice(0, 380) } }).catch(() => null);
      if (r?.ok) {
        citations = r.citations;
        webContext = researchContext(r);
        trace.push({ label: "Researcher · Tavily search", model: "tavily", costUsd: 0, tokens: 0, ms: r.ms });
      }
    }

    const res = await routeCompletion({
      data: {
        mode: settings.mode,
        providerId: route.providerId,
        model: route.model,
        baseUrl: provider?.baseUrl ?? "https://api.x.ai/v1",
        apiKey,
        system: buildSystemPrompt({
          mode: settings.mode,
          files: live.files,
          memories: live.memories,
          openTabs: live.openTabs,
        }) + `\n\n${skillsPromptBlock(BUNDLED_SKILLS)}` + (webContext ? `\n\n${webContext}` : ""),
        messages: history,
        maxTokens: maxTokensFor(settings.mode),
      },
    });

    window.clearInterval(tick);

    if (!res.ok) {
      fail(res.error);
      return;
    }

    trace.push({
      label: (settings.mode === "chat" ? "Chat" : "Orchestrator · plan + implement") + (res.attribution ? ` · ${res.attribution}` : ""),
      model: res.model,
      costUsd: res.costUsd ?? 0,
      tokens: res.tokens ?? 0,
      ms: res.ms ?? 0,
    });

    const payload = parseSwarmPayload(res.text);
    const messageId = applyPayload(
      payload,
      { providerId: res.providerId, model: res.model },
      { trace, citations },
    );

    if (settings.mode !== "chat" && res.providerId === "nebius" && payload.files?.length) {
      await reviewWithNano(messageId, payload.files);
      await verifyWorkspace(messageId, trimmed);
    }
  } catch (err) {
    window.clearInterval(tick);
    fail(err instanceof Error ? err.message : "Request failed");
  }
}

function fail(error: string) {
  const store = useWork.getState();
  store.patchCurrent((s) => ({
    ...s,
    swarm: { ...idleSwarm(), running: false, finishedAt: Date.now() },
    messages: [
      ...s.messages,
      {
        id: uid(),
        role: "assistant",
        content: error,
        createdAt: Date.now(),
      },
    ],
  }));
  toast.error(error);
}

/** Fast everyday call: Nemotron 3 Nano reviews the diff (cheap, low-latency). */
async function reviewWithNano(messageId: string, files: FileChange[]) {
  const route = resolveRoute("reviewer", useWork.getState().settings);
  if (route.providerId !== "nebius") return;
  const diff = files
    .map((f) => `--- ${f.action} ${f.path}\n${(f.content ?? "").slice(0, 3000)}`)
    .join("\n")
    .slice(0, 12_000);
  const r = await routeCompletion({
    data: {
      mode: "chat",
      providerId: "nebius",
      model: route.model,
      baseUrl: providerById("nebius")!.baseUrl,
      system:
        "You are a strict code reviewer. In at most 4 short bullets, flag bugs, missing tests, or security issues in this change. If it looks fine, say so in one line.",
      messages: [{ role: "user", content: diff }],
      maxTokens: 500,
    },
  }).catch(() => null);
  if (!r?.ok) return;
  useWork.getState().patchCurrent((s) => ({
    ...s,
    swarm: {
      ...s.swarm,
      agents: s.swarm.agents.map((a) => (a.id === "reviewer" ? { ...a, output: r.text, model: r.model } : a)),
    },
    messages: s.messages.map((m) =>
      m.id === messageId
        ? {
            ...m,
            review: r.text,
            trace: [
              ...(m.trace ?? []),
              { label: "Reviewer", model: r.model, costUsd: r.costUsd ?? 0, tokens: r.tokens ?? 0, ms: r.ms ?? 0 },
            ],
          }
        : m,
    ),
  }));
}

/** Write -> run -> test in a sandbox; Nemotron 3 Ultra repairs failures. Evidence lands on the message. */
export async function verifyWorkspace(messageId: string, task: string) {
  const store = useWork.getState();
  const session = store.current();
  if (session.pending?.length) return; // wait for permission before executing anything
  const files = Object.fromEntries(Object.values(session.files).map((f) => [f.path, f.content]));
  toast("Running tests in sandbox…");
  try {
    const out = await runVerifyLoop({ data: { files, task } });
    if (!out.command) return;
    const verification: VerificationResult = {
      command: out.command,
      passed: out.passed,
      attempts: out.attempts,
      costUsd: out.costUsd,
      changed: out.changed,
      steps: out.steps,
    };
    if (out.changed.length) {
      store.snapshotFiles();
      for (const p of out.changed) {
        const c = out.files[p];
        if (typeof c === "string") store.upsertFile(p, c);
      }
    }
    store.patchCurrent((s) => ({
      ...s,
      messages: s.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              verification,
              trace: [
                ...(m.trace ?? []),
                ...out.steps
                  .filter((st) => st.kind === "repair")
                  .map((st) => ({
                    label: `Repair #${st.attempt}`,
                    model: st.kind === "repair" ? st.model : NEMOTRON.ultra,
                    costUsd: st.kind === "repair" ? st.costUsd : 0,
                    tokens: st.kind === "repair" ? st.tokens : 0,
                    ms: 0,
                  })),
              ],
            }
          : m,
      ),
    }));
    if (out.passed) toast.success(`Tests pass (attempt ${out.attempts})`);
    else toast.error("Tests still failing — see evidence");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Sandbox run failed");
  }
}

function applyPayload(
  payload: ReturnType<typeof parseSwarmPayload>,
  routed: { providerId: string; model: string },
  extra: { trace: TraceStep[]; citations: Citation[] } = { trace: [], citations: [] },
): string {
  const messageId = uid();
  const store = useWork.getState();
  const permission = store.settings.permission ?? "default";
  const holdWrites = permission !== "auto";

  const applied: FileChange[] = [];
  for (const change of payload.files ?? []) {
    const path = safePath(change.path);
    if (!path) continue;
    if (change.action === "delete") {
      applied.push({ ...change, path });
    } else if (typeof change.content === "string") {
      applied.push({ ...change, path });
    }
  }

  if (!holdWrites && applied.length) {
    store.snapshotFiles();
    for (const change of applied) {
      if (change.action === "delete") store.deleteFile(change.path);
      else if (typeof change.content === "string") store.upsertFile(change.path, change.content);
    }
  }

  const agentResults: SwarmAgent[] = AGENTS.map((def) => {
    const hit = payload.agents?.find((a) => a.id === def.id);
    return {
      id: def.id,
      status: "done",
      thought: hit?.thought ?? "",
      output: hit?.output ?? (def.id === "orchestrator" ? payload.summary : ""),
      model: routed.model,
      finishedAt: Date.now(),
    };
  });

  store.patchCurrent((s) => {
    const memories = [...s.memories];
    for (const m of payload.memories ?? []) {
      memories.push({
        id: uid(),
        kind: m.kind,
        content: m.content,
        tags: m.tags ?? [],
        createdAt: Date.now(),
        strength: 0.75,
      });
    }
    const title = payload.title?.trim();
    const firstFile = applied.find((f) => f.action !== "delete");
    return {
      ...s,
      title: title && s.messages.filter((m) => m.role === "user").length <= 1 ? title : s.title,
      memories,
      pending: holdWrites ? applied : [],
      swarm: {
        running: false,
        startedAt: s.swarm.startedAt,
        finishedAt: Date.now(),
        agents: agentResults,
      },
      messages: [
        ...s.messages,
        {
          id: messageId,
          role: "assistant",
          content: payload.summary,
          createdAt: Date.now(),
          artifacts: applied,
          routed,
          trace: extra.trace,
          citations: extra.citations,
        },
      ],
      openTabs:
        !holdWrites && firstFile && !s.openTabs.includes(firstFile.path)
          ? [...s.openTabs, firstFile.path]
          : s.openTabs,
      activeTab: !holdWrites && firstFile ? firstFile.path : s.activeTab,
    };
  });

  if (holdWrites && applied.length) {
    toast(`${applied.length} file change${applied.length === 1 ? "" : "s"} waiting for permission`);
  } else if (applied.length) {
    toast(`Updated ${applied.length} file${applied.length === 1 ? "" : "s"}`);
  } else {
    toast("Task finished");
  }
  return messageId;
}
