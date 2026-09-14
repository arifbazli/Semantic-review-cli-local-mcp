import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Spawns the actual built CLI's `mcp` command as a subprocess over stdio —
// the same entrypoint any agent (Claude Code, etc.) would configure as an
// MCP server, not a mock of the transport.
const FIXTURES_DIR = fileURLToPath(new URL("../fixtures", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

describe("MCP server — real subprocess over stdio", () => {
  const dir = resolve(FIXTURES_DIR, "interprocedural");
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({ command: "node", args: [CLI_PATH, "mcp", "--dir", dir] });
    client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(transport);
  }, 20_000);

  afterAll(async () => {
    await client.close();
  });

  it("lists exactly the three expected tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["search", "trace_callees", "trace_callers"]);
  });

  it("trace_callers over MCP matches the ground truth from the direct engine call", async () => {
    const result = await client.callTool({ name: "trace_callers", arguments: { functionName: "getItemById" } });
    const content = result.content as { type: string; text: string }[];
    const parsed = JSON.parse(content[0].text);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].file).toContain("routes.ts");
  });
});
