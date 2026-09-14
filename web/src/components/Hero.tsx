interface HeroProps {
  image?: string;
  title: string;
  subtitle?: string;
  owned?: boolean;
  onPlay: () => void;
}

export default function Hero({ image, title, subtitle, owned = true, onPlay }: HeroProps) {
  return (
    <div className="hero">
      {image && <div className="hero-bg" style={{ backgroundImage: `url(${image})` }} />}
      <div className="hero-scrim" />
      <div className="hero-content">
        <div className="hero-title">{title}</div>
        {subtitle && <div className="hero-subtitle">{subtitle}</div>}
        {owned ? (
          <button className="hero-play" onClick={onPlay}>
            ▶ Play
          </button>
        ) : (
          <div className="hero-unowned">Not in your library</div>
        )}
      </div>
    </div>
  );
}
