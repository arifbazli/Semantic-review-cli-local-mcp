import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const DEFAULT_EXCLUDE_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", ".semantic-index"]);

export function walkSourceFiles(rootDir: string, excludeDirs: Set<string> = DEFAULT_EXCLUDE_DIRS): string[] {
  const results: string[] = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (!excludeDirs.has(entry)) stack.push(full);
      } else if (SOURCE_EXTENSIONS.has(extname(entry))) {
        results.push(full);
      }
    }
  }
  return results;
}
