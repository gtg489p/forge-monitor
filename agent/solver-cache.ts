import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// Solver cache — download, verify sha256, store on disk
// ---------------------------------------------------------------------------

const CACHE_DIR =
  process.env.SOLVER_CACHE_DIR?.replace("~", process.env.HOME ?? "") ??
  join(process.env.HOME ?? ".", ".forge-monitor", "solvers");

async function ensureCacheDir(): Promise<void> {
  if (!existsSync(CACHE_DIR)) {
    await mkdir(CACHE_DIR, { recursive: true });
  }
}

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function getSolver(
  solverUrl: string,
  solverChecksum: string | null
): Promise<{ path: string } | { error: string }> {
  await ensureCacheDir();

  // Use checksum as filename if available, otherwise hash the URL
  const filename = solverChecksum ?? sha256(new TextEncoder().encode(solverUrl));
  const solverPath = join(CACHE_DIR, filename);

  // Check cache
  if (existsSync(solverPath)) {
    if (solverChecksum) {
      const existing = await Bun.file(solverPath).arrayBuffer();
      const hash = sha256(new Uint8Array(existing));
      if (hash === solverChecksum) {
        return { path: solverPath };
      }
      console.warn("[solver-cache] cached file checksum mismatch, re-downloading");
    } else {
      return { path: solverPath };
    }
  }

  // Download
  console.log(`[solver-cache] downloading ${solverUrl}`);
  let res: Response;
  try {
    res = await fetch(solverUrl, { signal: AbortSignal.timeout(60_000) });
  } catch (err) {
    return { error: `download failed: ${err}` };
  }

  if (!res.ok) {
    return { error: `download failed: HTTP ${res.status}` };
  }

  const data = new Uint8Array(await res.arrayBuffer());

  // Verify checksum
  if (solverChecksum) {
    const hash = sha256(data);
    if (hash !== solverChecksum) {
      return { error: `solver_checksum_mismatch: expected ${solverChecksum}, got ${hash}` };
    }
  }

  // Write to cache and make executable
  await Bun.write(solverPath, data);
  const { chmod } = await import("fs/promises");
  await chmod(solverPath, 0o755);

  console.log(`[solver-cache] cached at ${solverPath}`);
  return { path: solverPath };
}
