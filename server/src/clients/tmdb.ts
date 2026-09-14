import { NotConfiguredError, settingsStore } from "../settingsStore.js";

const API_BASE = "https://api.themoviedb.org/3";
const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

export interface TmdbItem {
  id: number;
  title: string;
  year?: number;
  poster?: string;
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
    genre: raw.genre_ids?.length ? genres.get(raw.genre_ids[0]) : undefined,
    ratingPercent: raw.vote_average ? Math.round(raw.vote_average * 10) : undefined,
    type,
  };
}

export async function getPopularMovies(): Promise<TmdbItem[]> {
  const [data, genres] = await Promise.all([
    tmdbFetch<{ results: RawTmdbResult[] }>("/movie/popular"),
    getMovieGenres(),
  ]);
  return data.results.map((r) => toItem(r, "movie", genres));
}

export async function getPopularShows(): Promise<TmdbItem[]> {
  const [data, genres] = await Promise.all([
    tmdbFetch<{ results: RawTmdbResult[] }>("/tv/popular"),
    getShowGenres(),
  ]);
  return data.results.map((r) => toItem(r, "show", genres));
}
