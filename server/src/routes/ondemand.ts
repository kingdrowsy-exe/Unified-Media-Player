import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { cached } from "../cache.js";
import { listPopularLibraryItems, PlexItem, searchLibraryItems } from "../clients/plex.js";
import { listSiloItems, SiloItem } from "../clients/silo.js";
import { mergeLibraries } from "../merge.js";
import { NotConfiguredError } from "../settingsStore.js";

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

export async function onDemandRoutes(app: FastifyInstance) {
  app.get("/api/ondemand", async (request) => {
    const { search, source } = request.query as { search?: string; source?: string };

    // A search term goes straight to Plex's own title search (server-side, across the
    // whole library) rather than filtering the small "popular" page we cache - otherwise
    // titles outside that bounded page would never be found.
    const { merged, sources } = search
      ? await (async () => {
          const [plex, silo] = await Promise.all([
            safeList<PlexItem>(() => searchLibraryItems(search)),
            safeList<SiloItem>(listSiloItems),
          ]);
          return {
            merged: mergeLibraries(plex.items, silo.items),
            sources: { plex: plex.configured, silo: silo.configured },
          };
        })()
      : await cached("ondemand:popular", config.cacheTtlSeconds, async () => {
          const [plex, silo] = await Promise.all([
            safeList<PlexItem>(listPopularLibraryItems),
            safeList<SiloItem>(listSiloItems),
          ]);
          return {
            merged: mergeLibraries(plex.items, silo.items),
            sources: { plex: plex.configured, silo: silo.configured },
          };
        });

    let items = merged;

    if (source && source !== "all") {
      items = items.filter((item) => item.sources.some((s) => s.source === source));
    }

    return { items, sources };
  });
}
