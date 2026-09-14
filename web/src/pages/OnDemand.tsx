import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MergedItem, fetchOnDemand, streamUrlFor } from "../api.js";
import Player from "../components/Player.js";
import Hero from "../components/Hero.js";
import Shelf from "../components/Shelf.js";
import Tile from "../components/Tile.js";

type SourceFilter = "all" | "plex" | "silo";

export default function OnDemand() {
  const [items, setItems] = useState<MergedItem[]>([]);
  const [sources, setSources] = useState<{ plex: boolean; silo: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<MergedItem | null>(null);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      fetchOnDemand({ search: search || undefined, source: source === "all" ? undefined : source })
        .then((res) => {
          setItems(res.items);
          setSources(res.sources);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [search, source]);

  function play(item: MergedItem) {
    setPlaying(item);
  }

  const playSource = playing?.sources[0];
  const noSourcesConnected = sources && !sources.plex && !sources.silo;
  const isSearching = search.trim().length > 0;

  const movies = useMemo(() => items.filter((i) => i.type === "movie"), [items]);
  const shows = useMemo(() => items.filter((i) => i.type === "show"), [items]);
  const featured = items[0];

  function renderTile(item: MergedItem) {
    return (
      <Tile
        key={item.id}
        image={item.poster}
        title={item.title}
        genre={item.genre}
        ratingPercent={item.ratingPercent}
        year={item.year}
        badges={item.sources.map((s) => s.source)}
        onClick={() => play(item)}
      />
    );
  }

  return (
    <div className="page">
      {!isSearching && featured && (
        <Hero
          image={featured.poster}
          title={featured.title}
          subtitle={[featured.year, featured.sources.map((s) => s.source).join(" · ")]
            .filter(Boolean)
            .join(" · ")}
          onPlay={() => play(featured)}
        />
      )}

      {sources && !sources.plex && sources.silo && (
        <div className="notice">
          Plex isn't connected yet — showing Silo only. <Link to="/settings">Connect Plex</Link>
        </div>
      )}
      {sources && !sources.silo && sources.plex && (
        <div className="notice">
          Silo isn't connected yet — showing Plex only. <Link to="/settings">Connect Silo</Link>
        </div>
      )}

      <div className="toolbar">
        <input
          type="text"
          placeholder="Search titles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(["all", "plex", "silo"] as const).map((s) => (
          <span key={s} className={`chip ${source === s ? "active" : ""}`} onClick={() => setSource(s)}>
            {s === "all" ? "All" : s === "plex" ? "Plex" : "Silo"}
          </span>
        ))}
      </div>

      {loading && <div className="status">Loading library…</div>}
      {error && <div className="status">Failed to load library: {error}</div>}

      {!loading && !error && noSourcesConnected && (
        <div className="status">
          Neither Plex nor Silo is connected yet.
          <br />
          <Link to="/settings">Go to Settings</Link> to connect one.
        </div>
      )}

      {!loading && !error && !noSourcesConnected && items.length === 0 && (
        <div className="status">No titles found.</div>
      )}

      {!loading && !error && !noSourcesConnected && isSearching && items.length > 0 && (
        <Shelf title="Search Results">{items.map(renderTile)}</Shelf>
      )}

      {!loading && !error && !noSourcesConnected && !isSearching && (
        <>
          {movies.length > 0 && <Shelf title="Popular Movies">{movies.map(renderTile)}</Shelf>}
          {shows.length > 0 && <Shelf title="Popular Shows">{shows.map(renderTile)}</Shelf>}
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
