interface HeroProps {
  image?: string;
  title: string;
  subtitle?: string;
  onPlay: () => void;
}

export default function Hero({ image, title, subtitle, onPlay }: HeroProps) {
  return (
    <div className="hero">
      {image && <div className="hero-bg" style={{ backgroundImage: `url(${image})` }} />}
      <div className="hero-scrim" />
      <div className="hero-content">
        <div className="hero-title">{title}</div>
        {subtitle && <div className="hero-subtitle">{subtitle}</div>}
        <button className="hero-play" onClick={onPlay}>
          ▶ Play
        </button>
      </div>
    </div>
  );
}
