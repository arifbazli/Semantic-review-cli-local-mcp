import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { ConfigSchema, type Config } from "./schema.js";

const DEFAULT_CONFIG: Config = ConfigSchema.parse({ version: 1, provider: "ollama" });

export function configPath(dir: string): string {
  return join(dir, ".semantic-index", "config.yaml");
}

export function loadConfig(dir: string): Config {
  const path = configPath(dir);
  if (!existsSync(path)) {
    throw new Error(`No config found at ${path} — run "semantic-index init" first.`);
  }
  const raw = yaml.load(readFileSync(path, "utf-8"));
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config at ${path}: ${result.error.message}`);
  }
  return result.data;
}

export function writeDefaultConfig(dir: string, overrides: Partial<Pick<Config, "model">> = {}): Config {
  const config = ConfigSchema.parse({ ...DEFAULT_CONFIG, ...overrides });
  const indexDir = join(dir, config.index.dir);
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(configPath(dir), yaml.dump(config), "utf-8");
  return config;
}
