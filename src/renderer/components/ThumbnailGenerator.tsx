import { useEffect, useRef, useState } from 'react';
import {
  renderThumbnail,
  ThumbnailContent,
  ThumbnailStyle,
} from '../common/thumbnailDrawing';

export default function ThumbnailGenerator({
  set,
  style,
}: {
  set: ThumbnailContent;
  style: ThumbnailStyle;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState('Preparing thumbnail...');
  const {
    player1,
    player2,
    character1,
    character2,
    tournamentName,
    roundText,
    eventName,
  } = set;
  const { color, logo, background } = style;
  useEffect(() => {
    let active = true;
    setStatus('Preparing thumbnail...');
    renderThumbnail(
      {
        player1,
        player2,
        character1,
        character2,
        tournamentName,
        roundText,
        eventName,
      },
      { color, logo, background }
    )
      .then((image) => {
        if (!active || !canvas.current) return undefined;
        const context = canvas.current.getContext('2d');
        if (!context) throw new Error('The thumbnail preview is unavailable.');
        context.clearRect(0, 0, 1280, 720);
        context.drawImage(image, 0, 0);
        setStatus('');
        return undefined;
      })
      .catch((error) => {
        if (active)
          setStatus(
            `Thumbnail unavailable: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
      });
    return () => {
      active = false;
    };
  }, [
    player1,
    player2,
    character1,
    character2,
    tournamentName,
    roundText,
    eventName,
    color,
    logo,
    background,
  ]);
  return (
    <div
      className="generated-thumbnail"
      data-thumbnail-ready={!status}
      role="img"
      aria-busy={status === 'Preparing thumbnail...'}
      aria-label={
        status ||
        `${player1} versus ${player2}, ${
          roundText || 'Match'
        }, ${tournamentName}. ${
          character1 || 'Character not reported'
        } versus ${character2 || 'Character not reported'}.`
      }
    >
      <canvas ref={canvas} width={1280} height={720} aria-hidden="true" />
      {status && (
        <div className="thumbnail-status" role="status">
          {status}
        </div>
      )}
    </div>
  );
}
