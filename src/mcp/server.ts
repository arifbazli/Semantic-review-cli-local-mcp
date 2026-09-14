import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchIndex } from "../search/engine.js";
import { loadOrBuildGraph, traceCallees, traceCallers } from "../trace/engine.js";

/** Same engine as the CLI commands — this is the "one engine, two surfaces" point: an MCP-native agent (Claude Code, etc.) gets tool calls, everything else shells out to the CLI, both hit identical logic. */
export function createServer(dir: string): McpServer {
  const server = new McpServer({ name: "semantic-index", version: "0.1.0" });

  server.registerTool(
    "search",
    {
      title: "Semantic search",
      description: "Find code by meaning via local Ollama embeddings, not keyword matching. Requires `semantic-index init` to have run in this directory.",
      inputSchema: { query: z.string().min(1), topK: z.number().int().positive().max(50).optional() },
    },
    async ({ query, topK }) => ({
      content: [{ type: "text", text: JSON.stringify(await searchIndex(dir, query, topK ?? 8)) }],
    }),
  );

  server.registerTool(
    "trace_callers",
    {
      title: "Trace callers",
      description: "AST-based (tree-sitter) callers of a named function — not regex, so it correctly follows arrow functions, namespace-import indirection, and class methods.",
      inputSchema: { functionName: z.string().min(1), file: z.string().optional() },
    },
    async ({ functionName, file }) => ({
      content: [{ type: "text", text: JSON.stringify(traceCallers(loadOrBuildGraph(dir), functionName, file)) }],
    }),
  );

  server.registerTool(
    "trace_callees",
    {
      title: "Trace callees",
      description: "AST-based (tree-sitter) callees of a named function — what it calls.",
      inputSchema: { functionName: z.string().min(1), file: z.string().optional() },
    },
    async ({ functionName, file }) => ({
      content: [{ type: "text", text: JSON.stringify(traceCallees(loadOrBuildGraph(dir), functionName, file)) }],
    }),
  );

  return server;
}
