import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { cached } from "../cache.js";
import { getPopularMovies, getPopularShows, TmdbItem } from "../clients/tmdb.js";
import { getOwnedPopularLibrary } from "../library.js";
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

    // TMDB's popular charts are shown regardless of ownership; cross-referencing against
    // the already-cached owned library (by normalized title+year) tells us which of those
    // are actually playable, without issuing any extra Plex/Silo requests.
    const owned = await getOwnedPopularLibrary();
    const ownedByKey = new Map(owned.merged.map((m) => [matchKey(m.title, m.year), m]));

    function toPopularItem(t: TmdbItem): PopularItem {
      const local = ownedByKey.get(matchKey(t.title, t.year));
      return {
        id: `tmdb:${t.type}:${t.id}`,
        title: t.title,
        year: t.year,
        type: t.type,
        poster: t.poster,
        backdrop: t.backdrop,
        genre: t.genre,
        ratingPercent: t.ratingPercent,
        sources: local?.sources ?? [],
      };
    }

    return {
      movies: tmdb.movies.map(toPopularItem),
      shows: tmdb.shows.map(toPopularItem),
      configured: true,
    };
  });
}
