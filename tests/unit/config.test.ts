import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "../../src/config/schema.js";
import { configPath, loadConfig, writeDefaultConfig } from "../../src/config/loader.js";

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("ConfigSchema", () => {
  it("fills in defaults for a minimal input", () => {
    const config = ConfigSchema.parse({ version: 1, provider: "ollama" });
    expect(config.model).toBe("nomic-embed-text");
    expect(config.ollama.baseUrl).toBe("http://localhost:11434");
    expect(config.index.dir).toBe(".semantic-index");
    expect(config.scan.excludeDirs).toContain("node_modules");
  });

  it("rejects an unsupported provider", () => {
    expect(() => ConfigSchema.parse({ version: 1, provider: "openai" })).toThrow();
  });
});

describe("loadConfig / writeDefaultConfig", () => {
  it("throws a clear error when no config exists yet", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-config-"));
    expect(() => loadConfig(dir)).toThrow(/run "semantic-index init"/);
  });

  it("round-trips a written config, applying an override", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-config-"));
    writeDefaultConfig(dir, { model: "custom-model" });
    const loaded = loadConfig(dir);
    expect(loaded.model).toBe("custom-model");
    expect(loaded.provider).toBe("ollama");
  });

  it("throws a clear error when the config file fails schema validation", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-config-"));
    mkdirSync(join(dir, ".semantic-index"), { recursive: true });
    writeFileSync(configPath(dir), "version: 1\nprovider: not-ollama\n", "utf-8");
    expect(() => loadConfig(dir)).toThrow(/Invalid config/);
  });
});
