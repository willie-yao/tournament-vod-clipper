import { useEffect, useRef, useState } from 'react';
import ThumbnailGenerator from './ThumbnailGenerator';
import { VODMetadata } from '../common/tournamentSets';

export interface ThumbnailStyle {
  color: string;
  logo: string;
  background: string;
}

export default function ThumbnailPreview({
  set,
  style,
}: {
  set: VODMetadata;
  style: ThumbnailStyle;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useEffect(() => {
    if (!host.current || typeof ResizeObserver === 'undefined')
      return undefined;
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / 1280)
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={host}
      className="thumbnail-preview"
      aria-label={`Thumbnail for ${set.player1} vs ${set.player2}`}
    >
      <div style={{ transform: `scale(${scale})` }}>
        <ThumbnailGenerator
          bgImage={style.background}
          bgColor={style.color}
          logo={style.logo}
          player1={set.player1}
          player2={set.player2}
          character1={set.character1}
          character2={set.character2}
          bottomText={set.tournamentName}
        />
      </div>
    </div>
  );
}
