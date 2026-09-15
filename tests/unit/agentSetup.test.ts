import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { upsertBlock } from "../../src/agentSetup/writeFiles.js";

let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("upsertBlock", () => {
  it("creates the file with the block when it doesn't exist", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-agentsetup-"));
    const path = join(dir, "CLAUDE.md");
    upsertBlock(path, "hello");
    expect(readFileSync(path, "utf-8")).toContain("hello");
  });

  it("appends the block to an existing file with unrelated content", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-agentsetup-"));
    const path = join(dir, "CLAUDE.md");
    writeFileSync(path, "# My project\n\nSome instructions.\n", "utf-8");
    upsertBlock(path, "hello");
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("# My project");
    expect(content).toContain("hello");
  });

  it("replaces the block in place on a second call, without duplicating it", () => {
    dir = mkdtempSync(join(tmpdir(), "semantic-index-agentsetup-"));
    const path = join(dir, "CLAUDE.md");
    upsertBlock(path, "version one");
    upsertBlock(path, "version two");
    const content = readFileSync(path, "utf-8");
    expect(content).not.toContain("version one");
    expect(content.match(/version two/g)).toHaveLength(1);
  });
});
