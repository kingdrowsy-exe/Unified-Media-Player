import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MergedItem, PopularItem, fetchOnDemand, fetchPopular, streamUrlFor } from "../api.js";
import Player from "../components/Player.js";
import Hero, { HeroItem } from "../components/Hero.js";
import Shelf from "../components/Shelf.js";
import Tile from "../components/Tile.js";

const HERO_SLIDE_COUNT = 8;

// Alternate movie/show/movie/show... so the rotation isn't just "all movies then all shows".
function interleave<T>(a: T[], b: T[]): T[] {
  const result: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) result.push(a[i]);
    if (b[i]) result.push(b[i]);
  }
  return result;
}

type SourceFilter = "all" | "plex" | "silo";
type Playable = MergedItem | PopularItem;

function bySource(source: SourceFilter) {
  return (item: { sources: { source: "plex" | "silo"; id: string }[] }) =>
    source === "all" || item.sources.some((s) => s.source === source);
}

export default function OnDemand() {
  const [items, setItems] = useState<MergedItem[]>([]);
  const [sources, setSources] = useState<{ plex: boolean; silo: boolean } | null>(null);
  const [popularMovies, setPopularMovies] = useState<PopularItem[]>([]);
  const [popularShows, setPopularShows] = useState<PopularItem[]>([]);
  const [tmdbConfigured, setTmdbConfigured] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Playable | null>(null);

  const isSearching = search.trim().length > 0;

  useEffect(() => {
    fetchPopular()
      .then((res) => {
        setPopularMovies(res.movies);
        setPopularShows(res.shows);
        setTmdbConfigured(res.configured);
      })
      .catch(() => setTmdbConfigured(false));
  }, []);

  useEffect(() => {
    if (!isSearching) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      fetchOnDemand({ search, source: source === "all" ? undefined : source })
        .then((res) => {
          setItems(res.items);
          setSources(res.sources);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [search, source, isSearching]);

  function play(item: Playable) {
    if (item.sources.length === 0) return;
    setPlaying(item);
  }

  const playSource = playing?.sources[0];
  const noSourcesConnected = sources && !sources.plex && !sources.silo;

  const filteredMovies = useMemo(() => popularMovies.filter(bySource(source)), [popularMovies, source]);
  const filteredShows = useMemo(() => popularShows.filter(bySource(source)), [popularShows, source]);

  const heroItems: HeroItem[] = useMemo(
    () =>
      interleave(filteredMovies, filteredShows)
        .slice(0, HERO_SLIDE_COUNT)
        .map((item) => ({
          image: item.backdrop ?? item.poster,
          title: item.title,
          subtitle: [item.year, item.genre].filter(Boolean).join(" · "),
          owned: item.sources.length > 0,
          onPlay: () => play(item),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredMovies, filteredShows],
  );

  function renderTile(item: Playable) {
    return (
      <Tile
        key={item.id}
        image={item.poster}
        title={item.title}
        genre={item.genre}
        ratingPercent={item.ratingPercent}
        year={item.year}
        owned={item.sources.length > 0}
        badges={item.sources.map((s) => s.source)}
        onClick={() => play(item)}
      />
    );
  }

  return (
    <div className="page">
      {!isSearching && heroItems.length > 0 && <Hero items={heroItems} />}

      {!isSearching && tmdbConfigured === false && (
        <div className="notice">
          TMDB isn't connected yet, so Popular Movies/Shows aren't available.{" "}
          <Link to="/settings">Connect TMDB</Link>
        </div>
      )}

      {isSearching && sources && !sources.plex && sources.silo && (
        <div className="notice">
          Plex isn't connected yet — showing Silo only. <Link to="/settings">Connect Plex</Link>
        </div>
      )}
      {isSearching && sources && !sources.silo && sources.plex && (
        <div className="notice">
          Silo isn't connected yet — showing Plex only. <Link to="/settings">Connect Silo</Link>
        </div>
      )}

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search your library…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(["all", "plex", "silo"] as const).map((s) => (
          <span key={s} className={`chip ${source === s ? "active" : ""}`} onClick={() => setSource(s)}>
            {s === "all" ? "All" : s === "plex" ? "Plex" : "Silo"}
          </span>
        ))}
      </div>

      {isSearching && loading && <div className="status">Searching…</div>}
      {isSearching && error && <div className="status">Search failed: {error}</div>}

      {isSearching && !loading && !error && noSourcesConnected && (
        <div className="status">
          Neither Plex nor Silo is connected yet.
          <br />
          <Link to="/settings">Go to Settings</Link> to connect one.
        </div>
      )}

      {isSearching && !loading && !error && !noSourcesConnected && items.length === 0 && (
        <div className="status">No titles found.</div>
      )}

      {isSearching && !loading && !error && !noSourcesConnected && items.length > 0 && (
        <Shelf title="Search Results">{items.map(renderTile)}</Shelf>
      )}

      {!isSearching && (
        <>
          {filteredMovies.length > 0 && <Shelf title="Popular Movies">{filteredMovies.map(renderTile)}</Shelf>}
          {filteredShows.length > 0 && <Shelf title="Popular Shows">{filteredShows.map(renderTile)}</Shelf>}
        </>
      )}

      {playing && playSource && (
        <Player
          src={streamUrlFor(playSource.source, playSource.id)}
          title={playing.title}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}
