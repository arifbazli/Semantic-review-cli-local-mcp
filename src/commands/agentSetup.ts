import { resolve } from "node:path";
import { runAgentSetup, type AgentSetupOptions } from "../agentSetup/writeFiles.js";

export function runAgentSetupCommand(opts: AgentSetupOptions & { dir?: string }): void {
  const dir = resolve(opts.dir ?? ".");
  const written = runAgentSetup(dir, opts);
  console.log(`Wrote/updated: ${written.join(", ")}`);
}
