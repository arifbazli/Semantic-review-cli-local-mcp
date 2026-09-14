import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { INSTRUCTION_BLOCK, subagentContent } from "./blocks.js";

const START = "<!-- semantic-index:start -->";
const END = "<!-- semantic-index:end -->";

/** Idempotent marked-block upsert: creates the file if missing, replaces the block in place if the markers already exist, otherwise appends — safe to re-run after a tool upgrade without duplicating content. */
export function upsertBlock(path: string, block: string): void {
  const wrapped = `${START}\n${block}\n${END}`;
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${wrapped}\n`, "utf-8");
    return;
  }

  const existing = readFileSync(path, "utf-8");
  const startIdx = existing.indexOf(START);
  const endIdx = existing.indexOf(END);
  if (startIdx !== -1 && endIdx !== -1) {
    writeFileSync(path, `${existing.slice(0, startIdx)}${wrapped}${existing.slice(endIdx + END.length)}`, "utf-8");
  } else {
    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    writeFileSync(path, `${existing}${separator}${wrapped}\n`, "utf-8");
  }
}

export interface AgentSetupOptions {
  claude?: boolean;
  copilot?: boolean;
  agentsMd?: boolean;
  withSubagent?: boolean;
}

/** No target flags means "write all three" — the default is maximal agent coverage, not minimal surprise. */
export function runAgentSetup(dir: string, opts: AgentSetupOptions): string[] {
  const anyTargetFlag = opts.claude || opts.copilot || opts.agentsMd;
  const written: string[] = [];

  if (!anyTargetFlag || opts.claude) {
    upsertBlock(join(dir, "CLAUDE.md"), INSTRUCTION_BLOCK);
    written.push("CLAUDE.md");
  }
  if (!anyTargetFlag || opts.agentsMd) {
    upsertBlock(join(dir, "AGENTS.md"), INSTRUCTION_BLOCK);
    written.push("AGENTS.md");
  }
  if (!anyTargetFlag || opts.copilot) {
    upsertBlock(join(dir, ".github", "copilot-instructions.md"), INSTRUCTION_BLOCK);
    written.push(".github/copilot-instructions.md");
  }
  if (opts.withSubagent) {
    const subagentPath = join(dir, ".claude", "agents", "code-navigator.md");
    mkdirSync(dirname(subagentPath), { recursive: true });
    writeFileSync(subagentPath, subagentContent(), "utf-8");
    written.push(".claude/agents/code-navigator.md");
  }

  return written;
}
