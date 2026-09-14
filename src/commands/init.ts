import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { configPath, loadConfig, writeDefaultConfig } from "../config/loader.js";
import { fullReindex } from "../indexer/reindex.js";

export interface InitOptions {
  force?: boolean;
  model?: string;
}

export async function runInit(dirArg: string, opts: InitOptions): Promise<void> {
  const dir = resolve(dirArg);
  const exists = existsSync(configPath(dir));

  const config = exists && !opts.force ? loadConfig(dir) : writeDefaultConfig(dir, { model: opts.model });
  if (exists && !opts.force) {
    console.log(`Using existing config at ${configPath(dir)} (pass --force to reset it).`);
  } else {
    console.log(`Wrote config to ${configPath(dir)}.`);
  }

  console.log(`Indexing ${dir} ...`);
  const stats = await fullReindex(dir, config);
  console.log(`Scanned ${stats.filesScanned} files, found ${stats.functionsFound} functions.`);
  console.log(`Embedded ${stats.chunksEmbedded} chunks (reused ${stats.chunksReused} unchanged, removed ${stats.chunksDeleted}).`);
}
