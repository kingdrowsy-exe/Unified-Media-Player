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

export async function popularRoutes(app: FastifyInstance) {
  app.get("/api/popular", async () => {
    let tmdb: { movies: TmdbItem[]; shows: TmdbItem[] };
    try {
      tmdb = await cached("popular:tmdb", config.cacheTtlSeconds, async () => {
        // Sequential, not Promise.all - keeps requests to TMDB spaced out one at a time
        // rather than bursting, even though this only ever runs once per cache window.
        const movies = await getPopularMovies();
        const shows = await getPopularShows();
        return { movies, shows };
      });
    } catch (err) {
      if (err instanceof NotConfiguredError) {
        return { movies: [], shows: [], configured: false };
      }
      throw err;
    }

    // Whether a TMDB popular title is actually in your library is deliberately NOT
    // precomputed here: checking all ~48 shown titles against Plex/Silo would mean that
    // many live queries every cache refresh, and checking only the small cached "popular"
    // page (like an earlier version of this route did) gave wrong "not in library" answers
    // for things you actually own. Ownership is instead checked live, once, when you
    // actually click a title - see GET /api/match.
    const toPopularItem = (t: TmdbItem): PopularItem => ({
      id: `tmdb:${t.type}:${t.id}`,
      title: t.title,
      year: t.year,
      type: t.type,
      poster: t.poster,
      backdrop: t.backdrop,
      genre: t.genre,
      ratingPercent: t.ratingPercent,
      sources: [],
    });

    return {
      movies: tmdb.movies.map(toPopularItem),
      shows: tmdb.shows.map(toPopularItem),
      configured: true,
    };
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
