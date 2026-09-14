import { NotConfiguredError, settingsStore } from "../settingsStore.js";

export interface PlexItem {
  ratingKey: string;
  title: string;
  year?: number;
  type: string;
  thumb?: string;
  Genre?: { tag: string }[];
  audienceRating?: number;
  rating?: number;
}

interface PlexDirectory {
  key: string;
  title: string;
  type: string;
}

function requirePlex() {
  const plex = settingsStore.getPlex();
  if (!plex) {
    throw new NotConfiguredError("plex");
  }
  return plex;
}

async function plexFetch<T>(path: string): Promise<T> {
  const plex = requirePlex();
  const url = new URL(plex.baseUrl + path);
  url.searchParams.set("X-Plex-Token", plex.token);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Plex request failed: ${res.status} ${path}`);
  }
  return (await res.json()) as T;
}

export async function listSections(): Promise<PlexDirectory[]> {
  const data = await plexFetch<{ MediaContainer: { Directory: PlexDirectory[] } }>("/library/sections");
  return data.MediaContainer.Directory ?? [];
}

async function moviesAndShowSections(): Promise<PlexDirectory[]> {
  const sections = await listSections();
  return sections.filter((s) => s.type === "movie" || s.type === "show");
}

async function fetchAcrossSections(queryString: string): Promise<PlexItem[]> {
  const sections = await moviesAndShowSections();
  const results = await Promise.all(
    sections.map(async (section) => {
      const data = await plexFetch<{ MediaContainer: { Metadata?: PlexItem[] } }>(
        `/library/sections/${section.key}/all?${queryString}`,
      );
      return data.MediaContainer.Metadata ?? [];
    }),
  );
  return results.flat();
}

// Pulling an entire library section can mean thousands of items against a slow/remote
// Plex server. For the browse grid we only need a bounded "popular" page per section
// (sorted by rating); full per-item detail is fetched separately and lazily, only when
// the user actually clicks something, via resolvePlexStreamUrl.
const POPULAR_PAGE_SIZE = 24;

export async function listPopularLibraryItems(): Promise<PlexItem[]> {
  return fetchAcrossSections(`sort=rating:desc&X-Plex-Container-Start=0&X-Plex-Container-Size=${POPULAR_PAGE_SIZE}`);
}

export async function searchLibraryItems(query: string): Promise<PlexItem[]> {
  return fetchAcrossSections(`title=${encodeURIComponent(query)}`);
}

export function plexPosterUrl(thumb?: string): string | undefined {
  if (!thumb) return undefined;
  const plex = settingsStore.getPlex();
  if (!plex) return undefined;
  const url = new URL(plex.baseUrl + thumb);
  url.searchParams.set("X-Plex-Token", plex.token);
  return url.toString();
}

export async function resolvePlexStreamUrl(ratingKey: string): Promise<string> {
  const plex = requirePlex();
  const data = await plexFetch<{
    MediaContainer: { Metadata?: { Media?: { Part?: { key: string }[] }[] }[] };
  }>(`/library/metadata/${ratingKey}`);
  const part = data.MediaContainer.Metadata?.[0]?.Media?.[0]?.Part?.[0];
  if (!part) {
    throw new Error(`No playable part found for Plex item ${ratingKey}`);
  }
  const url = new URL(plex.baseUrl + part.key);
  url.searchParams.set("X-Plex-Token", plex.token);
  return url.toString();
}
