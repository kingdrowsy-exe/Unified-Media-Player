import type { FastifyInstance } from "fastify";
import { getOwnedPopularLibrary } from "../library.js";

export async function onDemandRoutes(app: FastifyInstance) {
  app.get("/api/ondemand", async (request) => {
    const { search, source } = request.query as { search?: string; source?: string };

    // Search only filters the already-cached "popular" page rather than issuing a fresh
    // title-filtered query to Plex per keystroke - a title/sort query against the whole
    // library forces Plex to internally evaluate the entire section server-side, and the
    // provider hosting this Plex server flagged repeated full-library scans from this app.
    const { merged, sources } = await getOwnedPopularLibrary();

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
