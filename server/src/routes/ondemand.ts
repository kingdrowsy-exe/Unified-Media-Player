import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { cached } from "../cache.js";
import { listPopularLibraryItems, PlexItem } from "../clients/plex.js";
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

    // Search only filters the already-cached "popular" page rather than issuing a fresh
    // title-filtered query to Plex per keystroke - a title/sort query against the whole
    // library forces Plex to scan the entire section server-side even for a small result
    // page, and the provider hosting this Plex server flagged repeated full-library scans
    // from this app. Trade-off: search only covers what's in the cached popular set, not
    // the whole library - acceptable to avoid hammering the origin on every keystroke.
    const { merged, sources } = await cached("ondemand:popular", config.cacheTtlSeconds, async () => {
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

    if (search) {
      const needle = search.toLowerCase();
      items = items.filter((item) => item.title.toLowerCase().includes(needle));
    }

    return { items, sources };
  });
}
