import { Alert, Button, IconButton } from '@mui/material';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import { useId } from 'react';
import { ClipDraft, draftError } from '../common/clipDraft';
import { formatClipTime, parseClipTime } from '../../common/clipTime';
import { getVideoTitleError } from '../../common/files';

interface Props {
  part?: 'all' | 'times' | 'title';
  id?: string;
  draft: ClipDraft;
  saved?: ClipDraft;
  originalTitle?: string;
  onChange: (draft: ClipDraft) => void;
  disabled: boolean;
  duration?: number;
  playhead?: number;
  onSeek?: (time: number) => void;
  playerReady?: boolean;
  iconButtons?: boolean;
}

function ActionButton({
  className,
  icon,
  iconOnly,
  label,
  disabled,
  onClick,
}: {
  className: string;
  icon: JSX.Element;
  iconOnly: boolean;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return iconOnly ? (
    <IconButton
      className={className}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </IconButton>
  ) : (
    <Button
      className={className}
      variant="outlined"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

export default function ClipFields({
  part = 'all',
  id: idProp,
  draft,
  saved,
  originalTitle,
  onChange,
  disabled,
  duration,
  playhead,
  onSeek,
  playerReady = false,
  iconButtons = false,
}: Props) {
  const error = draftError(draft, duration);
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const showTimes = part !== 'title';
  const showTitle = part !== 'times';
  const titleError = getVideoTitleError(draft.title);
  const timeError = error && error !== titleError ? error : null;
  const shownError = { all: error, times: timeError, title: titleError }[part];
  const alertId = `${id}-${part === 'title' ? 'title-' : ''}validation`;
  return (
    <div className="clip-fields">
      {showTimes && (
        <div className="time-fields">
          {(['start', 'end'] as const).map((field) => {
            const label = field === 'start' ? 'In' : 'Out';
            const parsed = parseClipTime(draft[field]);
            const original = saved ? parseClipTime(saved[field]) : null;
            const difference =
              parsed !== null && original !== null ? parsed - original : 0;
            return (
              <div key={field} className="field">
                <label htmlFor={`${id}-${field}`}>
                  {label} · elapsed {field}
                </label>
                <input
                  id={`${id}-${field}`}
                  className="mono"
                  aria-label={`${label} time`}
                  aria-invalid={Boolean(part === 'all' ? error : timeError)}
                  aria-describedby={
                    (part === 'all' ? error : timeError)
                      ? `${id}-validation`
                      : undefined
                  }
                  placeholder="HH:mm:ss"
                  value={draft[field]}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange({ ...draft, [field]: event.target.value })
                  }
                />
                {saved && (
                  <span className="boundary-delta mono">
                    {parsed !== null &&
                      (original === null || difference !== 0) && (
                        <>
                          {original === null
                            ? 'New boundary'
                            : `${difference > 0 ? '+' : '-'}${formatClipTime(
                                Math.abs(difference)
                              )}`}{' '}
                          · draft
                        </>
                      )}
                  </span>
                )}
                {onSeek && (
                  <ActionButton
                    className="seek-button"
                    icon={
                      field === 'start' ? <FirstPageIcon /> : <LastPageIcon />
                    }
                    iconOnly={iconButtons}
                    label={`Seek to ${label}`}
                    disabled={
                      disabled ||
                      !playerReady ||
                      parsed === null ||
                      (duration !== undefined && parsed > duration)
                    }
                    onClick={() => parsed !== null && onSeek(parsed)}
                  />
                )}
                {onSeek && (
                  <ActionButton
                    className="set-button"
                    icon={field === 'start' ? <LoginIcon /> : <LogoutIcon />}
                    iconOnly={iconButtons}
                    label={`Set ${label} from playhead`}
                    disabled={disabled || playhead === undefined}
                    onClick={() =>
                      playhead !== undefined &&
                      onChange({ ...draft, [field]: formatClipTime(playhead) })
                    }
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      {showTitle && (
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
      )}
      {showTitle && originalTitle && (
        <details className="help">
          <summary>Full generated title</summary>
          <p>{originalTitle}</p>
        </details>
      )}
      {shownError && (
        <Alert id={alertId} severity="warning">
          {shownError}
        </Alert>
      )}
    </div>
  );
}

ClipFields.defaultProps = {
  part: 'all',
  id: undefined,
  saved: undefined,
  originalTitle: undefined,
  duration: undefined,
  playhead: undefined,
  onSeek: undefined,
  playerReady: false,
  iconButtons: false,
};
