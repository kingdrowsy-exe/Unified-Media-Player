import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { cached } from "../cache.js";
import { getPopularMovies, getPopularShows, TmdbItem } from "../clients/tmdb.js";
import { searchOwnedLibrary } from "../library.js";
import { matchKey } from "../merge.js";
import { NotConfiguredError } from "../settingsStore.js";

export interface PopularItem {
  id: string;
  title: string;
  year?: number;
  type: "movie" | "show";
  poster?: string;
  backdrop?: string;
  genre?: string;
  ratingPercent?: number;
  sources: { source: "plex" | "silo"; id: string }[];
}

function toPopularItem(t: TmdbItem): PopularItem {
  return {
    id: `tmdb:${t.type}:${t.id}`,
    title: t.title,
    year: t.year,
    type: t.type,
    poster: t.poster,
    backdrop: t.backdrop,
    genre: t.genre,
    ratingPercent: t.ratingPercent,
    sources: [],
  };
}

// Each title's ownership check is a live, targeted Plex/Silo search (the same one GET
// /api/match uses) - never a full-library scan. The Popular shelves hold 25 movies + 25
// shows, and this whole batch is wrapped in the same cache as the TMDB list itself, so it
// runs at most once per cache window no matter how many people load the page. A small
// concurrency cap just keeps that one-time batch from bursting all 50 lookups at once
// against Plex/Silo.
const MATCH_CONCURRENCY = 4;

async function attachOwnership(items: PopularItem[]): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      try {
        const { merged } = await searchOwnedLibrary(item.title);
        const targetKey = matchKey(item.title, item.year);
        const match = merged.find((m) => matchKey(m.title, m.year) === targetKey);
        if (match) item.sources = match.sources;
      } catch {
        // Leave unmatched on any lookup failure - the tile just shows as not-in-library.
      }
    }
  }
  await Promise.all(Array.from({ length: MATCH_CONCURRENCY }, worker));
}

export async function popularRoutes(app: FastifyInstance) {
  app.get("/api/popular", async () => {
    try {
      return await cached("popular:full", config.cacheTtlSeconds, async () => {
        // Sequential, not Promise.all - keeps requests to TMDB spaced out one at a time
        // rather than bursting, even though this only ever runs once per cache window.
        const movies = (await getPopularMovies()).map(toPopularItem);
        const shows = (await getPopularShows()).map(toPopularItem);
        await Promise.all([attachOwnership(movies), attachOwnership(shows)]);
        return { movies, shows, configured: true };
      });
    } catch (err) {
      if (err instanceof NotConfiguredError) {
        return { movies: [], shows: [], configured: false };
      }
      throw err;
    }
  });

  app.get("/api/match", async (request) => {
    const { title, year } = request.query as { title?: string; year?: string };
    if (!title) {
      return { sources: [] };
    }
    const { merged } = await searchOwnedLibrary(title);
    const targetKey = matchKey(title, year ? Number(year) : undefined);
    const match = merged.find((item) => matchKey(item.title, item.year) === targetKey);
    return { sources: match?.sources ?? [] };
  });
}
