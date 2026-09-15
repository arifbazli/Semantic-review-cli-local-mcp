import { resolve } from "node:path";
import chokidar from "chokidar";
import { loadConfig } from "../config/loader.js";
import { fullReindex } from "../indexer/reindex.js";

export interface WatchOptions {
  debounce?: number;
}

export async function runWatch(dirArg: string, opts: WatchOptions): Promise<void> {
  const dir = resolve(dirArg);
  const config = loadConfig(dir); // throws with a clear message if "init" hasn't run yet
  const debounceMs = opts.debounce ?? 2000;
  const excludeDirs = new Set(config.scan.excludeDirs);

  console.log(`Watching ${dir} (debounce ${debounceMs}ms). Ctrl+C to stop.`);

  let timer: NodeJS.Timeout | null = null;

  const scheduleReindex = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fullReindex(dir, config)
        .then((stats) =>
          console.log(
            `[reindex] embedded ${stats.chunksEmbedded}, reused ${stats.chunksReused}, deleted ${stats.chunksDeleted}` +
              (stats.chunksFailed > 0 ? `, failed ${stats.chunksFailed} (will retry next run)` : ""),
          ),
        )
        .catch((err) => console.error("[reindex] failed:", err));
    }, debounceMs);
  };

  const watcher = chokidar.watch(dir, {
    // chokidar always hands `ignored` a forward-slash-normalized path, even on Windows
    // (confirmed empirically) — splitting on the OS-specific `sep` (backslash on Windows)
    // never breaks the path into segments there, so excludeDirs would silently never match.
    ignored: (path: string) => path.split("/").some((segment) => excludeDirs.has(segment)),
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher
    .on("add", scheduleReindex)
    .on("change", scheduleReindex)
    .on("unlink", scheduleReindex)
    .on("error", (err: unknown) => console.error("[watch] error:", err));

  await new Promise<void>((resolveWatch) => {
    process.on("SIGINT", () => {
      if (timer) clearTimeout(timer);
      watcher.close().then(() => resolveWatch());
    });
  });
}
