import { config } from "./config.js";
import { cached } from "./cache.js";
import { listPopularLibraryItems, PlexItem, searchLibraryItems as searchPlexItems } from "./clients/plex.js";
import { listSiloItems, searchSiloItems, SiloItem } from "./clients/silo.js";
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

// A real, live, title-filtered search against Plex and Silo - both use targeted, indexed
// queries (not a full library scan), so this is safe to run per user-initiated search
// rather than only searching the small cached "popular" page, which would miss almost
// everything you actually own.
export async function searchOwnedLibrary(query: string): Promise<OwnedLibrary> {
  const [plex, silo] = await Promise.all([
    safeList<PlexItem>(() => searchPlexItems(query)),
    safeList<SiloItem>(() => searchSiloItems(query)),
  ]);
  return {
    merged: mergeLibraries(plex.items, silo.items),
    sources: { plex: plex.configured, silo: silo.configured },
  };
}
