import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EXAMPLE_WORKFLOW, validateWorkflow, type NodeType, type WfNode, type Workflow } from "@/lib/workflow/schema";
import { runWorkflowFn } from "@/lib/workflow/workflow";
import { saveWorkflowFn } from "@/lib/board/board";
import type { WfResult } from "@/lib/workflow/engine";
import { useSession } from "@/lib/store";
import { cn } from "@/lib/utils";

const KEY = "coding-agent.workflow.v1";
const W = 130;
const H = 44;
const TONE: Record<NodeType, string> = {
  start: "#10b981", end: "#64748b", llm: "#6366f1", tool: "#f59e0b", check: "#0ea5e9", condition: "#ec4899",
};

function load(): Workflow {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) return JSON.parse(raw) as Workflow;
  } catch { /* fall through */ }
  return EXAMPLE_WORKFLOW;
}

export function WorkflowPanel() {
  const session = useSession();
  const [wf, setWf] = useState<Workflow>(load);
  const [sel, setSel] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<WfResult | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(wf)); }, [wf]);
  const errors = validateWorkflow(wf);
  const node = wf.nodes.find((n) => n.id === sel) ?? null;

  const patchNode = (id: string, p: Partial<WfNode>) => setWf((w) => ({ ...w, nodes: w.nodes.map((n) => (n.id === id ? { ...n, ...p } : n)) }));
  const addNode = (type: NodeType) => {
    let i = 1;
    while (wf.nodes.some((n) => n.id === `${type}${i}`)) i++;
    const cfg: WfNode["config"] = type === "llm" ? { prompt: "{{input}}", tier: "super" } : type === "tool" ? { tool: "security-scan" } : type === "check" ? { command: "npm test" } : type === "condition" ? { expr: "input not empty" } : undefined;
    setWf((w) => ({ ...w, nodes: [...w.nodes, { id: `${type}${i}`, type, x: 60 + 30 * i, y: 260, config: cfg }] }));
  };
  const clickNode = (id: string) => {
    if (linkFrom && linkFrom !== id) {
      const from = wf.nodes.find((n) => n.id === linkFrom);
      const when = from?.type === "condition" ? (wf.edges.some((e) => e.from === linkFrom && e.when === "true") ? "false" : "true") : undefined;
      setWf((w) => ({ ...w, edges: [...w.edges, { from: linkFrom, to: id, ...(when ? { when } : {}) }] }));
      setLinkFrom(null);
    } else setSel(id);
  };
  const removeSel = () => {
    if (!sel) return;
    setWf((w) => ({ ...w, nodes: w.nodes.filter((n) => n.id !== sel), edges: w.edges.filter((e) => e.from !== sel && e.to !== sel) }));
    setSel(null);
  };
  const pt = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const run = async () => {
    setBusy(true); setErr(""); setRes(null);
    try {
      const files = Object.fromEntries(Object.values(session.files ?? {}).map((f) => [f.path, f.content]));
      setRes(await runWorkflowFn({ data: { workflow: wf, input, files } }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const pos = (id: string) => { const n = wf.nodes.find((x) => x.id === id); return { x: n?.x ?? 0, y: n?.y ?? 0 }; };
  const stepOf = (id: string) => res?.steps.find((s) => s.node === id);

  return (
    <div className="code-scroll h-full overflow-auto p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl tracking-tight">Workflows</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Build a DAG of Nemotron calls, tools, sandbox checks and conditions. Drag nodes; click “Link” then two nodes to connect.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["llm", "tool", "check", "condition", "end"] as NodeType[]).map((t) => (
            <Button key={t} size="sm" variant="outline" onClick={() => addNode(t)}>+ {t}</Button>
          ))}
          <Button size="sm" variant={linkFrom ? "default" : "outline"} disabled={!sel} onClick={() => setLinkFrom(sel)}>
            {linkFrom ? `Linking from ${linkFrom}…` : "Link"}
          </Button>
          <Button size="sm" variant="outline" disabled={!sel} onClick={removeSel}>Delete</Button>
          <Button size="sm" variant="outline" onClick={() => setWf(EXAMPLE_WORKFLOW)}>Reset example</Button>
          <Button size="sm" variant="outline" onClick={() => void saveWorkflowFn({ data: { id: wf.id, name: wf.name, definition: wf } }).then(() => setErr(`Saved as "${wf.id}" — reference it from a board task.`), (e: Error) => setErr(e.message))}>Save to DB</Button>
          <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(JSON.stringify(wf, null, 2))}>Copy JSON</Button>
        </div>
        <svg
          ref={svg}
          className="mt-4 h-[340px] w-full rounded-lg bg-card shadow-[var(--shadow-border)]"
          onPointerMove={(e) => { if (drag.current) { const p = pt(e); patchNode(drag.current.id, { x: p.x - drag.current.dx, y: p.y - drag.current.dy }); } }}
          onPointerUp={() => { drag.current = null; }}
          role="img"
          aria-label="Workflow graph"
        >
          {wf.edges.map((e, i) => {
            const a = pos(e.from); const b = pos(e.to);
            return (
              <g key={i}>
                <line x1={a.x + W} y1={a.y + H / 2} x2={b.x} y2={b.y + H / 2} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.5} />
                {e.when ? <text x={(a.x + W + b.x) / 2} y={(a.y + b.y) / 2 + H / 2 - 4} fontSize={10} fill="currentColor">{e.when}</text> : null}
              </g>
            );
          })}
          {wf.nodes.map((n) => {
            const st = stepOf(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                onPointerDown={(e) => { const p = pt(e); drag.current = { id: n.id, dx: p.x - (n.x ?? 0), dy: p.y - (n.y ?? 0) }; }}
                onClick={() => clickNode(n.id)}
                className="cursor-pointer"
              >
                <rect width={W} height={H} rx={8} fill="var(--card)" stroke={sel === n.id ? "currentColor" : TONE[n.type]} strokeWidth={sel === n.id ? 2.5 : 1.5} />
                <text x={10} y={18} fontSize={11} fontWeight={600} fill={TONE[n.type]}>{n.type}</text>
                <text x={10} y={34} fontSize={11} fill="currentColor">{(n.label ?? n.id).slice(0, 18)}</text>
                {st ? <circle cx={W - 10} cy={10} r={5} fill={st.status === "ok" ? "#10b981" : st.status === "fail" ? "#ef4444" : "#94a3b8"} /> : null}
              </g>
            );
          })}
        </svg>
        {errors.length ? <ul className="mt-2 text-sm text-amber-600">{errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
        {node ? (
          <div className="mt-4 grid gap-2 rounded-lg bg-card p-4 text-sm shadow-[var(--shadow-border)] sm:grid-cols-2">
            <label className="grid gap-1">Label<input className="rounded border bg-background px-2 py-1" value={node.label ?? ""} onChange={(e) => patchNode(node.id, { label: e.target.value })} /></label>
            {node.type === "llm" ? (
              <>
                <label className="grid gap-1 sm:col-span-2">Prompt (use {"{{var}}"})<textarea className="min-h-20 rounded border bg-background px-2 py-1 font-mono" value={node.config?.prompt ?? ""} onChange={(e) => patchNode(node.id, { config: { ...node.config, prompt: e.target.value } })} /></label>
                <label className="grid gap-1">Nemotron tier<select className="rounded border bg-background px-2 py-1" value={node.config?.tier ?? "super"} onChange={(e) => patchNode(node.id, { config: { ...node.config, tier: e.target.value as "nano" } })}><option>nano</option><option>super</option><option>ultra</option></select></label>
              </>
            ) : null}
            {node.type === "tool" ? (
              <label className="grid gap-1">Tool<select className="rounded border bg-background px-2 py-1" value={node.config?.tool} onChange={(e) => patchNode(node.id, { config: { ...node.config, tool: e.target.value as "compliance" } })}><option>security-scan</option><option>compliance</option><option>write-file</option></select></label>
            ) : null}
            {node.type === "check" ? (
              <label className="grid gap-1">Sandbox command<input className="rounded border bg-background px-2 py-1 font-mono" value={node.config?.command ?? ""} onChange={(e) => patchNode(node.id, { config: { ...node.config, command: e.target.value } })} /></label>
            ) : null}
            {node.type === "condition" ? (
              <label className="grid gap-1">Condition<input className="rounded border bg-background px-2 py-1 font-mono" value={node.config?.expr ?? ""} onChange={(e) => patchNode(node.id, { config: { ...node.config, expr: e.target.value } })} /></label>
            ) : null}
            {node.type !== "start" && node.type !== "end" && node.type !== "condition" ? (
              <label className="grid gap-1">Output variable<input className="rounded border bg-background px-2 py-1 font-mono" value={node.config?.output ?? ""} placeholder={node.id} onChange={(e) => patchNode(node.id, { config: { ...node.config, output: e.target.value || undefined } })} /></label>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex gap-2">
          <input className="flex-1 rounded border bg-background px-3 py-2 text-sm" placeholder="Input ({{input}})" value={input} onChange={(e) => setInput(e.target.value)} />
          <Button disabled={busy || errors.length > 0} onClick={() => void run()}>{busy ? "Running…" : "Run workflow"}</Button>
        </div>
        {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
        {res ? (
          <ol className="mt-4 grid gap-2">
            {res.steps.map((s) => (
              <li key={s.node} className="rounded-lg bg-card p-3 text-sm shadow-[var(--shadow-border)]">
                <span className={cn("font-mono", s.status === "ok" ? "text-emerald-600" : s.status === "fail" ? "text-red-600" : "text-muted-foreground")}>{s.status}</span>{" "}
                <b>{s.node}</b> <span className="text-muted-foreground">{s.type}{s.model ? ` · ${s.model}` : ""} · {s.ms} ms</span>
                {s.output ? <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{s.output}</pre> : null}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  );
}
