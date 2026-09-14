import { config } from "./config.js";
import { cached } from "./cache.js";
import { listPopularLibraryItems, PlexItem } from "./clients/plex.js";
import { listSiloItems, SiloItem } from "./clients/silo.js";
import { mergeLibraries, MergedItem } from "./merge.js";
import { NotConfiguredError } from "./settingsStore.js";

async function safeList<T>(fn: () => Promise<T[]>): Promise<{ items: T[]; configured: boolean }> {
  try {
    return { items: await fn(), configured: true };
  } catch (err) {
    if (err instanceof NotConfiguredError) {
      return { items: [], configured: false };
    }
    throw err;
  }
}

export interface OwnedLibrary {
  merged: MergedItem[];
  sources: { plex: boolean; silo: boolean };
}

// Shared by /api/ondemand and /api/popular so both read the same cached, bounded
// "popular" page instead of each independently querying Plex/Silo.
export function getOwnedPopularLibrary(): Promise<OwnedLibrary> {
  return cached("ondemand:popular", config.cacheTtlSeconds, async () => {
    const [plex, silo] = await Promise.all([
      safeList<PlexItem>(listPopularLibraryItems),
      safeList<SiloItem>(listSiloItems),
    ]);
    return {
      merged: mergeLibraries(plex.items, silo.items),
      sources: { plex: plex.configured, silo: silo.configured },
    };
  });
}
