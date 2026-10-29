import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import {
  formatClipTime,
  getClipRangeError,
  parseClipTime,
} from '../../common/clipTime';
import { VODMetadata } from '../common/tournamentSets';

interface Props {
  set: VODMetadata;
  vodUrl: string;
  onClose: () => void;
  onSave: (startTime: number, endTime: number, title: string) => void;
}

export default function EditTimestampModal({
  set,
  vodUrl,
  onClose,
  onSave,
}: Props) {
  const [startText, setStartText] = useState(formatClipTime(set.startTime));
  const [endText, setEndText] = useState(formatClipTime(set.endTime));
  const [title, setTitle] = useState(set.title);
  const [previewTime, setPreviewTime] = useState(
    set.startTime !== null &&
      Number.isFinite(set.startTime) &&
      set.startTime >= 0
      ? set.startTime
      : 0
  );
  const [previewRevision, setPreviewRevision] = useState(0);
  const startTime = parseClipTime(startText);
  const endTime = parseClipTime(endText);
  const error = getClipRangeError(startTime, endTime);
  const twitchId =
    new URL(vodUrl).pathname.split('/').filter(Boolean).pop() || '';
  const twitchTime = `${Math.floor(previewTime / 3600)}h${Math.floor(
    (previewTime % 3600) / 60
  )}m${previewTime % 60}s`;
  const embedLink = `https://player.twitch.tv/?video=${encodeURIComponent(
    twitchId
  )}&t=${twitchTime}&parent=localhost&muted=true`;

  const preview = (time: number | null) => {
    if (time !== null) {
      setPreviewTime(time);
      setPreviewRevision((revision) => revision + 1);
    }
  };

  return (
    <Dialog open onClose={onClose} aria-labelledby="edit-match-title">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          padding: '20px',
          minWidth: '50vw',
        }}
      >
        <Typography
          id="edit-match-title"
          variant="h6"
          component="h2"
          textAlign="center"
        >
          Edit Match
        </Typography>
        <iframe
          title="Twitch VOD preview"
          src={embedLink}
          height="240"
          width="100%"
          key={previewRevision}
        />
        {set.needsCorrection && (
          <Alert severity="warning">{set.needsCorrection}</Alert>
        )}
        <TextField
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          helperText={`${title.length}/100 | YouTube title character limit`}
        />
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            label="Start Time"
            value={startText}
            onChange={(event) => setStartText(event.target.value)}
            error={Boolean(error)}
            helperText="Elapsed HH:mm:ss; hours can exceed 23."
            fullWidth
          />
          <Tooltip title="Skip to start">
            <span>
              <IconButton
                aria-label="Skip to start"
                disabled={startTime === null}
                onClick={() => preview(startTime)}
              >
                <SkipNextIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            label="End Time"
            value={endText}
            onChange={(event) => setEndText(event.target.value)}
            error={Boolean(error)}
            helperText="Elapsed HH:mm:ss; hours can exceed 23."
            fullWidth
          />
          <Tooltip title="Skip to end">
            <span>
              <IconButton
                aria-label="Skip to end"
                disabled={endTime === null}
                onClick={() => preview(endTime)}
              >
                <SkipNextIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          disabled={Boolean(error) || !title.trim()}
          variant="contained"
          color="secondary"
          onClick={() => {
            if (
              startTime !== null &&
              endTime !== null &&
              !error &&
              title.trim()
            ) {
              onSave(startTime, endTime, title.trim());
            }
          }}
        >
          Change
        </Button>
      </Box>
    </Dialog>
  );
}
