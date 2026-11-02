// Tiny MCP stdio server used by tests.
import readline from "node:readline";
const rl = readline.createInterface({ input: process.stdin });
const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
rl.on("line", (l) => {
  const m = JSON.parse(l);
  if (m.id === undefined) return;
  if (m.method === "initialize") send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: "2025-06-18", serverInfo: { name: "fake" }, capabilities: { tools: {} } } });
  else if (m.method === "tools/list") send({ jsonrpc: "2.0", id: m.id, result: { tools: [{ name: "add", description: "add numbers", inputSchema: { type: "object" } }] } });
  else if (m.method === "tools/call") send({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: String(m.params.arguments.a + m.params.arguments.b) }] } });
  else send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "method not found" } });
});
