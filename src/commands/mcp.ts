import { resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../mcp/server.js";

export async function runMcp(opts: { dir?: string }): Promise<void> {
  const dir = resolve(opts.dir ?? ".");
  const server = createServer(dir);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
