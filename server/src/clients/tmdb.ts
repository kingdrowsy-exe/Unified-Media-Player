import { NotConfiguredError, settingsStore } from "../settingsStore.js";

const API_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";

export interface TmdbItem {
  id: number;
  title: string;
  year?: number;
  poster?: string;
  backdrop?: string;
  genre?: string;
  ratingPercent?: number;
  type: "movie" | "show";
}

interface RawTmdbResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  genre_ids?: number[];
}

interface RawGenre {
  id: number;
  name: string;
}

function requireTmdb() {
  const tmdb = settingsStore.getTmdb();
  if (!tmdb) {
    throw new NotConfiguredError("tmdb");
  }
  return tmdb;
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const tmdb = requireTmdb();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${tmdb.accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`TMDB request failed: ${res.status} ${path}`);
  }
  return (await res.json()) as T;
}

// Genre id -> name lists rarely change, so cache them in-memory for the process lifetime
// instead of fetching on every popular-list request.
let movieGenres: Map<number, string> | null = null;
let showGenres: Map<number, string> | null = null;

async function getMovieGenres(): Promise<Map<number, string>> {
  if (movieGenres) return movieGenres;
  const data = await tmdbFetch<{ genres: RawGenre[] }>("/genre/movie/list");
  movieGenres = new Map(data.genres.map((g) => [g.id, g.name]));
  return movieGenres;
}

async function getShowGenres(): Promise<Map<number, string>> {
  if (showGenres) return showGenres;
  const data = await tmdbFetch<{ genres: RawGenre[] }>("/genre/tv/list");
  showGenres = new Map(data.genres.map((g) => [g.id, g.name]));
  return showGenres;
}

function toItem(raw: RawTmdbResult, type: "movie" | "show", genres: Map<number, string>): TmdbItem {
  const dateStr = raw.release_date || raw.first_air_date;
  return {
    id: raw.id,
    title: (raw.title ?? raw.name ?? "").trim(),
    year: dateStr ? Number(dateStr.slice(0, 4)) : undefined,
    poster: raw.poster_path ? `${POSTER_BASE}${raw.poster_path}` : undefined,
    backdrop: raw.backdrop_path ? `${BACKDROP_BASE}${raw.backdrop_path}` : undefined,
    genre: raw.genre_ids?.length ? genres.get(raw.genre_ids[0]) : undefined,
    ratingPercent: raw.vote_average ? Math.round(raw.vote_average * 10) : undefined,
    type,
  };
}

// TMDB returns 20 results per page, so getting 24 needs two page fetches. These happen
// at most once per CACHE_TTL_SECONDS (the caller wraps this in the shared cache), and are
// fetched sequentially rather than in parallel - simple, deliberate throttling to stay
// far under TMDB's rate limit (40 req/s) regardless of how many things call this at once.
const POPULAR_COUNT = 24;
const PAGE_SIZE = 20;

async function fetchPopularPages(path: string): Promise<RawTmdbResult[]> {
  const results: RawTmdbResult[] = [];
  for (let page = 1; results.length < POPULAR_COUNT; page++) {
    const data = await tmdbFetch<{ results: RawTmdbResult[]; total_pages: number }>(
      `${path}?page=${page}`,
    );
    results.push(...data.results);
    if (page >= data.total_pages || data.results.length < PAGE_SIZE) break;
  }
  return results.slice(0, POPULAR_COUNT);
}

export async function getPopularMovies(): Promise<TmdbItem[]> {
  const genres = await getMovieGenres();
  const results = await fetchPopularPages("/movie/popular");
  return results.map((r) => toItem(r, "movie", genres));
}

export async function getPopularShows(): Promise<TmdbItem[]> {
  const genres = await getShowGenres();
  const results = await fetchPopularPages("/tv/popular");
  return results.map((r) => toItem(r, "show", genres));
}
