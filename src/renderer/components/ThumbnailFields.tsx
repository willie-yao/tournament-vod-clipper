import { useId, useState } from 'react';
import { Alert, Autocomplete, Button, TextField } from '@mui/material';
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
  const [openPicker, setOpenPicker] = useState<1 | 2>();
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
  const side = (n: 1 | 2, label: string) => {
    const player = `player${n}` as const;
    const character = `character${n}` as const;
    return (
      <div className="thumbnail-fields-row">
        <TextField
          size="small"
          label={`${label} player`}
          value={draft[player]}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, [player]: event.target.value })
          }
        />
        <Autocomplete
          freeSolo
          size="small"
          options={THUMBNAIL_CHARACTERS}
          value={draft[character]}
          inputValue={draft[character]}
          disabled={disabled}
          open={openPicker === n && Boolean(draft[character].trim())}
          onClose={() => setOpenPicker(undefined)}
          onInputChange={(_, value, reason) => {
            // The list only opens once the operator types.
            if (reason === 'input') setOpenPicker(n);
            onChange({ ...draft, [character]: value });
          }}
          renderInput={(params) => (
            // eslint-disable-next-line react/jsx-props-no-spreading
            <TextField {...params} label={`${label} character`} />
          )}
        />
      </div>
    );
  };
  return (
    <section className="thumbnail-fields" aria-labelledby={headingId}>
      <div className="thumbnail-fields-head">
        <h3 id={headingId}>Thumbnail</h3>
        <Button
          size="small"
          startIcon={<SwapHorizIcon />}
          disabled={disabled}
          onClick={swap}
        >
          Swap sides
        </Button>
      </div>
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
      {side(1, 'Left')}
      {side(2, 'Right')}
      <TextField
        size="small"
        label="Round"
        value={draft.roundText}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...draft, roundText: event.target.value })
        }
      />
      {error && <Alert severity="warning">{error}</Alert>}
      {titleStale && (
        <p className="help">
          The video title still uses the previous player names.
        </p>
      )}
    </section>
  );
}
