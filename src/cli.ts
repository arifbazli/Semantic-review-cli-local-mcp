#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runWatch } from "./commands/watch.js";
import { runSearch } from "./commands/search.js";
import { runTrace } from "./commands/trace.js";
import { runAgentSetupCommand } from "./commands/agentSetup.js";
import { runMcp } from "./commands/mcp.js";

const program = new Command();
program.name("semantic-index").description("Agent-agnostic semantic code search: local Ollama embeddings + tree-sitter call-graph tracing.");

program
  .command("init")
  .option("--dir <path>", "project directory to index", ".")
  .option("--force", "overwrite existing config")
  .option("--model <name>", "Ollama embedding model", "nomic-embed-text")
  .action(async (opts) => {
    await runInit(opts.dir, { force: opts.force, model: opts.model });
  });

program
  .command("watch")
  .option("--dir <path>", "project directory to watch", ".")
  .option("--debounce <ms>", "debounce before re-indexing after a change", (v) => Number(v), 2000)
  .action(async (opts) => {
    await runWatch(opts.dir, { debounce: opts.debounce });
  });

program
  .command("search <query>")
  .option("--top-k <n>", "number of results", (v) => Number(v), 8)
  .option("--dir <path>", "project directory", ".")
  .option("--json", "output JSON")
  .action(async (query, opts) => {
    await runSearch(query, { topK: opts.topK, dir: opts.dir, json: opts.json });
  });

const trace = program.command("trace").description("AST-based call-graph tracing");
for (const direction of ["callers", "callees"] as const) {
  trace
    .command(`${direction} <functionName>`)
    .option("--file <path>", "disambiguate when the function name matches more than one definition")
    .option("--dir <path>", "project directory", ".")
    .option("--json", "output JSON")
    .action((functionName, opts) => {
      runTrace(direction, functionName, { file: opts.file, dir: opts.dir, json: opts.json });
    });
}

program
  .command("agent-setup")
  .option("--claude", "write CLAUDE.md")
  .option("--copilot", "write .github/copilot-instructions.md")
  .option("--agents-md", "write AGENTS.md")
  .option("--with-subagent", "also write a Claude Code subagent (.claude/agents/code-navigator.md)")
  .option("--dir <path>", "project directory", ".")
  .action((opts) => {
    runAgentSetupCommand({ claude: opts.claude, copilot: opts.copilot, agentsMd: opts.agentsMd, withSubagent: opts.withSubagent, dir: opts.dir });
  });

program
  .command("mcp")
  .option("--dir <path>", "project directory", ".")
  .action(async (opts) => {
    await runMcp({ dir: opts.dir });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
