import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "../../src/config/schema.js";
import {
  callGraphFilePath,
  indexFilePath,
  readCallGraphFile,
  readIndexFile,
  writeCallGraphFile,
  writeIndexFile,
} from "../../src/indexer/store.js";

const config = ConfigSchema.parse({ version: 1, provider: "ollama" });

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("index file round-trip", () => {
  it("writes and reads back an index file, atomically (no leftover .tmp)", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-store-"));
    mkdirSync(join(dir, config.index.dir), { recursive: true });

    writeIndexFile(dir, config, {
      version: 1,
      provider: "ollama",
      model: "nomic-embed-text",
      dimensions: 3,
      chunks: [
        { id: "a", file: "f.ts", functionName: "f", startLine: 1, endLine: 2, contentHash: "h1", truncated: false, embedding: [1, 2, 3] },
      ],
    });

    const loaded = readIndexFile(dir, config);
    expect(loaded?.chunks).toHaveLength(1);
    expect(loaded?.chunks[0].embedding).toEqual([1, 2, 3]);
    expect(existsSync(`${indexFilePath(dir, config)}.tmp`)).toBe(false);
  });

  it("returns null when no index file exists", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-store-"));
    expect(readIndexFile(dir, config)).toBeNull();
  });
});

describe("call graph file round-trip", () => {
  it("writes and reads back a call graph, atomically (no leftover .tmp)", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-store-"));
    mkdirSync(join(dir, config.index.dir), { recursive: true });

    const functions = new Map([["fn1", { id: "fn1", name: "foo", file: "f.ts", node: {} as never, startLine: 1, endLine: 2 }]]);
    writeCallGraphFile(dir, config, { functions, edges: [{ callerId: "fn1", calleeId: "fn1" }], unresolved: [] });

    const loaded = readCallGraphFile(dir, config);
    expect(loaded?.functions).toHaveLength(1);
    expect(loaded?.edges).toEqual([{ callerId: "fn1", calleeId: "fn1" }]);
    expect(existsSync(`${callGraphFilePath(dir, config)}.tmp`)).toBe(false);
  });
});
