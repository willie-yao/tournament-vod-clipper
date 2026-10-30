import { Alert, Button } from '@mui/material';
import { useId } from 'react';
import { ClipDraft, draftError } from '../common/clipDraft';
import { formatClipTime, parseClipTime } from '../../common/clipTime';

interface Props {
  draft: ClipDraft;
  onChange: (draft: ClipDraft) => void;
  disabled: boolean;
  duration?: number;
  playhead?: number;
  onSeek?: (time: number) => void;
  playerReady?: boolean;
}

export default function ClipFields({
  draft,
  onChange,
  disabled,
  duration,
  playhead,
  onSeek,
  playerReady = false,
}: Props) {
  const error = draftError(draft, duration);
  const id = useId();
  return (
    <div className="clip-fields">
      <div className="time-fields">
        {(['start', 'end'] as const).map((field) => {
          const label = field === 'start' ? 'In' : 'Out';
          const parsed = parseClipTime(draft[field]);
          return (
            <div key={field} className="field">
              <label htmlFor={`${id}-${field}`}>
                {label} · elapsed {field}
              </label>
              <input
                id={`${id}-${field}`}
                className="mono"
                aria-label={`${label} time`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-validation` : `${id}-help`}
                placeholder="HH:mm:ss"
                value={draft[field]}
                disabled={disabled}
                onChange={(event) =>
                  onChange({ ...draft, [field]: event.target.value })
                }
              />
              {onSeek && (
                <Button
                  variant="outlined"
                  disabled={
                    disabled ||
                    !playerReady ||
                    parsed === null ||
                    (duration !== undefined && parsed > duration)
                  }
                  onClick={() => parsed !== null && onSeek(parsed)}
                >
                  Seek to {label}
                </Button>
              )}
              {onSeek && (
                <Button
                  variant="outlined"
                  disabled={disabled || playhead === undefined}
                  onClick={() =>
                    playhead !== undefined &&
                    onChange({ ...draft, [field]: formatClipTime(playhead) })
                  }
                >
                  Set {label} from playhead
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <p className="help" id={`${id}-help`}>
        Elapsed HH:mm:ss from the VOD start. Hours can exceed 23; Out must be
        after In.
      </p>
      <label className="field" htmlFor={`${id}-title`}>
        Video title
        <input
          id={`${id}-title`}
          aria-label="Video title"
          value={draft.title}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...draft, title: event.target.value })
          }
        />
        <span>{[...draft.title].length}/100 characters for YouTube</span>
      </label>
      {error && (
        <Alert id={`${id}-validation`} severity="warning">
          {error}
        </Alert>
      )}
    </div>
  );
}

ClipFields.defaultProps = {
  duration: undefined,
  playhead: undefined,
  onSeek: undefined,
  playerReady: false,
};
