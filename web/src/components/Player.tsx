import { useRef } from "react";
import { useHlsVideo } from "../hooks/useHlsVideo.js";

interface PlayerProps {
  src: string;
  title: string;
  onClose: () => void;
  /** Live IPTV streams are HLS (.m3u8) and need hls.js; Plex/Silo direct-play files can be set as the video src as-is. */
  isHls?: boolean;
}

export default function Player({ src, title, onClose, isHls = false }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { error, playing } = useHlsVideo(videoRef, src, isHls);

  return (
    <div className="player-overlay" onClick={onClose}>
      <video ref={videoRef} controls autoPlay onClick={(e) => e.stopPropagation()} />
      {!error && !playing && <div className="player-status">Loading…</div>}
      {error && <div className="player-status player-status-error">{error}</div>}
      <div onClick={(e) => e.stopPropagation()}>
        <p style={{ color: "var(--text-muted)", margin: "8px 0" }}>{title}</p>
        <button className="player-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
