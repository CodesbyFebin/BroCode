// Minimal MCP client over stdio (JSON-RPC 2.0, newline-delimited): initialize, tools/list, tools/call.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type McpTool = { name: string; description?: string; inputSchema?: unknown };
export class McpStdioClient {
  private p?: ChildProcessWithoutNullStreams;
  private id = 0;
  private pending = new Map<number, { res: (v: unknown) => void; rej: (e: Error) => void }>();
  private buf = "";
  constructor(private command: string, private args: string[] = [], private env: Record<string, string> = {}, private timeoutMs = 30000) {}

  async connect() {
    this.p = spawn(this.command, this.args, { env: { ...process.env, ...this.env }, stdio: ["pipe", "pipe", "pipe"] });
    this.p.stdout.setEncoding("utf8").on("data", (d: string) => {
      this.buf += d;
      let i;
      while ((i = this.buf.indexOf("\n")) >= 0) {
        const line = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: { message: string } };
          const w = msg.id !== undefined ? this.pending.get(msg.id) : undefined;
          if (!w) continue;
          this.pending.delete(msg.id!);
          if (msg.error) w.rej(new Error(msg.error.message)); else w.res(msg.result);
        } catch { /* ignore non-JSON log lines */ }
      }
    });
    this.p.on("exit", () => { for (const w of this.pending.values()) w.rej(new Error("MCP server exited")); this.pending.clear(); });
    const init = await this.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "brocode", version: "2.0.0" } });
    this.notify("notifications/initialized");
    return init as { serverInfo?: { name: string } };
  }
  private notify(method: string, params?: unknown) { this.p!.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n"); }
  request(method: string, params?: unknown): Promise<unknown> {
    if (!this.p) throw new Error("not connected");
    const id = ++this.id;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { this.pending.delete(id); rej(new Error(`MCP ${method} timed out`)); }, this.timeoutMs);
      this.pending.set(id, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
      this.p!.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }
  async listTools(): Promise<McpTool[]> { return ((await this.request("tools/list", {})) as { tools: McpTool[] }).tools; }
  async callTool(name: string, args: Record<string, unknown>, allow?: string[]) {
    if (allow && !allow.includes(name)) throw new Error(`tool ${name} is not in the allowlist`);
    return (await this.request("tools/call", { name, arguments: args })) as { content: { type: string; text?: string }[]; isError?: boolean };
  }
  close() { this.p?.kill(); this.p = undefined; }
}
