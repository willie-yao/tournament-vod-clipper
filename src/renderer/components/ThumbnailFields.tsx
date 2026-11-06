import { CSSProperties, useId } from 'react';
import { Alert } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { ClipDraft, thumbnailDraftError } from '../common/clipDraft';
import { ThumbnailStyle } from '../common/thumbnailDrawing';
import { THUMBNAIL_CHARACTERS } from '../common/thumbnailPortraits';
import { VODMetadata } from '../common/tournamentSets';
import ThumbnailPreview from './ThumbnailPreview';

interface Props {
  set: VODMetadata;
  draft: ClipDraft;
  style: ThumbnailStyle;
  onChange: (draft: ClipDraft) => void;
  disabled: boolean;
}

export default function ThumbnailFields({
  set,
  draft,
  style,
  onChange,
  disabled,
}: Props) {
  const headingId = useId();
  const charactersId = `${headingId}-characters`;
  const error = thumbnailDraftError(draft);
  const title = draft.title.toLowerCase();
  const namesChanged =
    draft.player1 !== set.player1 || draft.player2 !== set.player2;
  const titleStale =
    namesChanged &&
    ![draft.player1, draft.player2].every((name) =>
      title.includes(name.trim().toLowerCase())
    );
  const swap = () =>
    onChange({
      ...draft,
      player1: draft.player2,
      player2: draft.player1,
      character1: draft.character2,
      character2: draft.character1,
    });
  const card = (n: 1 | 2, label: string, color: string) => {
    const player = `player${n}` as const;
    const character = `character${n}` as const;
    return (
      <div
        className="versus-card"
        style={{ '--field': color } as CSSProperties}
      >
        <span className="versus-side">
          <i aria-hidden="true" />
          {label}
        </span>
        <input
          className="versus-name"
          aria-label={`${label} player`}
          value={draft[player]}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, [player]: event.target.value })
          }
        />
        <input
          className="versus-character"
          aria-label={`${label} character`}
          list={charactersId}
          value={draft[character]}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, [character]: event.target.value })
          }
        />
      </div>
    );
  };
  return (
    <section className="thumbnail-fields" aria-labelledby={headingId}>
      <h3 id={headingId}>Thumbnail</h3>
      <ThumbnailPreview
        set={{
          ...set,
          player1: draft.player1,
          player2: draft.player2,
          character1: draft.character1,
          character2: draft.character2,
          roundText: draft.roundText,
        }}
        style={style}
      />
      <div className="versus">
        {card(1, 'Left', style.color)}
        <button
          type="button"
          className="versus-swap"
          aria-label="Swap sides"
          title="Swap sides"
          disabled={disabled}
          onClick={swap}
        >
          <SwapHorizIcon />
        </button>
        {card(2, 'Right', style.rightColor)}
      </div>
      <label className="versus-round" htmlFor={`${headingId}-round`}>
        Round
        <input
          id={`${headingId}-round`}
          value={draft.roundText}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, roundText: event.target.value })
          }
        />
      </label>
      <datalist id={charactersId}>
        {THUMBNAIL_CHARACTERS.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </datalist>
      {error && <Alert severity="warning">{error}</Alert>}
      {titleStale && (
        <p className="help">
          The video title still uses the previous player names.
        </p>
      )}
    </section>
  );
}
