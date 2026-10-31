import {
  Alert,
  Button,
  Box,
  MenuItem,
  TextField,
  Typography,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import AppShell from '../common/AppShell';
import OutputFolder from '../common/OutputFolder';
import { getVideoTitleError } from '../../common/files';
import type { YouTubeStatus } from '../../common/youtube';
import {
  UploadSession,
  uploadSession,
  uploadComplete,
} from '../common/uploadSession';

// Confirmed IDs survive navigation, but are never written to disk.
const sessions = new Map<string, UploadSession>();

interface UploadState {
  folderName?: string;
  videoNames?: string[];
}

const YTUploadView = () => {
  const { state }: { state: UploadState | null } = useLocation();
  const [description, setDescription] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState(state?.folderName || '');
  const [visibility, setVisibility] = useState('unlisted');
  const [connection, setConnection] = useState<YouTubeStatus | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [choosingOutput, setChoosingOutput] = useState(false);
  const busyRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [root, setRoot] = useState('');
  const [revision, setRevision] = useState(0);
  const [session, setSession] = useState<UploadSession | null>(null);
  const [requestedNames, setRequestedNames] = useState(state?.videoNames);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const connecting = loggingIn || connection?.state === 'connecting';
  const locked = busy || connecting || loading || choosingOutput;

  useEffect(() => {
    let active = true;
    const unsubscribe = window.electron.ipcRenderer.onYouTubeStatus(
      (status) => {
        if (active) setConnection(status);
      }
    );
    window.electron.ipcRenderer.getYouTubeStatus().then(
      (status) => {
        if (active) setConnection(status);
      },
      () => {
        if (active)
          setError(
            'Could not read the YouTube connection. Reopen this screen and try again.'
          );
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const directory =
          await window.electron.ipcRenderer.getOutputDirectory();
        const available =
          await window.electron.ipcRenderer.getTournamentFolders();
        if (!active) return;
        setRoot(directory);
        setFolders(available);
        if (selectedFolder) {
          const names = await window.electron.ipcRenderer.getVideosInFolder(
            selectedFolder
          );
          if (!active) return;
          const selected = requestedNames
            ? names.filter((name) => requestedNames.includes(name))
            : names;
          const key = JSON.stringify([directory, selectedFolder]);
          const saved = sessions.get(key) || { items: [] };
          selected.forEach((name) => {
            if (!saved.items.some((item) => item.videoName === name)) {
              saved.items.push({
                videoName: name,
                title: name.replace(/\.mp4$/i, ''),
                thumbnailDone: false,
                thumbnailSkipped: false,
                playlistDone: false,
                error: '',
              });
            }
          });
          sessions.set(key, saved);
          setSession({
            ...saved,
            items: saved.items.filter((item) =>
              selected.includes(item.videoName)
            ),
          });
          if (saved.metadata) {
            setDescription(saved.metadata.description);
            setVisibility(saved.metadata.visibility);
          }
        } else {
          setSession(null);
        }
      } catch (failure) {
        if (active)
          setError(
            failure instanceof Error ? failure.message : String(failure)
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [selectedFolder, requestedNames, revision]);

  const login = async () => {
    setLoggingIn(true);
    setError('');
    try {
      const status = await window.electron.ipcRenderer.connectYouTube();
      setConnection(status);
    } catch (failure) {
      setError(
        `Connection failed: ${
          failure instanceof Error ? failure.message : String(failure)
        }`
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const disconnect = async () => {
    setError('');
    try {
      setConnection(await window.electron.ipcRenderer.disconnectYouTube());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  const upload = async () => {
    if (
      busyRef.current ||
      choosingOutput ||
      !session ||
      connection?.state !== 'connected'
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setSummary('');
    const key = JSON.stringify([root, selectedFolder]);
    const saved = sessions.get(key);
    const working = { ...session, items: [...session.items] };
    const report = () => {
      if (saved) {
        saved.channelId = working.channelId;
        saved.playlistId = working.playlistId;
        saved.metadata = working.metadata;
      }
      setSession({ ...working, items: [...working.items] });
    };
    try {
      await uploadSession(
        working,
        {
          folderName: selectedFolder,
          description,
          visibility,
          sessionId: connection.sessionId,
          channelId: connection.channel.id,
        },
        window.electron.ipcRenderer,
        report
      );
      const confirmed = working.items.filter((item) => item.videoId).length;
      const complete = working.items.filter(uploadComplete).length;
      const skipped = working.items.filter(
        (item) => item.thumbnailSkipped
      ).length;
      setSummary(
        `${confirmed} of ${
          working.items.length
        } videos confirmed; ${complete} fully processed.${
          skipped ? ` ${skipped} without an optional thumbnail.` : ''
        }`
      );
      if (complete !== working.items.length)
        setError(
          'Some steps need attention. Reconnect if needed, then retry failed steps. Confirmed videos will not be uploaded again.'
        );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      report();
      busyRef.current = false;
      setBusy(false);
    }
  };

  const complete =
    session !== null &&
    session.items.length > 0 &&
    session.items.every(uploadComplete);
  const metadataLocked = locked || Boolean(session?.playlistId);
  return (
    <AppShell current="output" locked={locked}>
      <main className="upload-page">
        <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
          Upload to YouTube
        </Typography>
        <OutputFolder
          disabled={locked}
          onChoosingChange={setChoosingOutput}
          onChange={() => {
            setLoading(true);
            setFolders([]);
            setSelectedFolder('');
            setRequestedNames(undefined);
            setSession(null);
            setSummary('');
            setRevision((value) => value + 1);
          }}
        />
        {error && <Alert severity="error">{error}</Alert>}
        {summary && (
          <Alert severity={complete ? 'success' : 'warning'}>{summary}</Alert>
        )}
        <Typography variant="body2">
          Review titles before uploading. Recovery IDs are kept only while this
          app is open. After a reload, restart, or any unconfirmed request,
          check both your YouTube channel and playlist before retrying. Playlist
          creation or membership may already have succeeded.
        </Typography>
        <section className="youtube-connection" aria-label="YouTube connection">
          <div className="youtube-account">
            <span className="connection-label">YOUTUBE CONNECTION</span>
            <Typography component="h2">
              {connection?.state === 'connected'
                ? connection.channel.title
                : 'Your channel, connected securely'}
            </Typography>
            {connection?.state === 'connected' && (
              <span className="mono help">Channel {connection.channel.id}</span>
            )}
            <Typography variant="body2" role="status">
              {connection?.message ||
                'Checking the saved YouTube connection...'}
            </Typography>
            <p className="help">
              Sign-in opens your browser. Credentials stay encrypted on this
              device. Disconnect removes the local connection, not access in
              your Google account.
            </p>
          </div>
          <div className="connection-actions">
            {connecting ? (
              <Button disabled={busy} variant="outlined" onClick={disconnect}>
                Cancel sign-in
              </Button>
            ) : (
              <>
                <Button
                  disabled={
                    locked ||
                    !connection ||
                    connection.state === 'not-configured'
                  }
                  variant="contained"
                  onClick={login}
                >
                  {connection?.state === 'connected' ||
                  connection?.state === 'reconnect-required'
                    ? 'Reconnect YouTube'
                    : 'Connect YouTube'}
                </Button>
                {connection &&
                  ['connected', 'reconnect-required', 'storage-error'].includes(
                    connection.state
                  ) && (
                    <Button disabled={locked} onClick={disconnect}>
                      Disconnect
                    </Button>
                  )}
              </>
            )}
          </div>
        </section>
        {session?.channelId &&
          connection?.state === 'connected' &&
          session.channelId !== connection.channel.id && (
            <Alert severity="warning">
              This batch belongs to another YouTube channel. Reconnect its
              original channel before retrying.
            </Alert>
          )}
        <Box className="background-card">
          <TextField
            required
            select
            label="VOD Folder"
            variant="filled"
            value={folders.includes(selectedFolder) ? selectedFolder : ''}
            disabled={locked}
            onChange={(event) => {
              setSelectedFolder(event.target.value);
              setRequestedNames(undefined);
              setSession(null);
              setSummary('');
            }}
          >
            {folders.map((folder) => (
              <MenuItem key={folder} value={folder}>
                {folder}
              </MenuItem>
            ))}
          </TextField>
          <Button
            disabled={locked || !selectedFolder}
            onClick={async () => {
              try {
                await window.electron.ipcRenderer.openFolder(selectedFolder);
              } catch (failure) {
                setError(
                  failure instanceof Error ? failure.message : String(failure)
                );
              }
            }}
          >
            Open VOD Folder
          </Button>
          <TextField
            disabled={metadataLocked}
            label="Video Description"
            variant="filled"
            rows={3}
            multiline
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FormControl disabled={metadataLocked}>
            <RadioGroup
              row
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
            >
              {['unlisted', 'public', 'private'].map((value) => (
                <FormControlLabel
                  key={value}
                  value={value}
                  control={<Radio />}
                  label={value}
                />
              ))}
            </RadioGroup>
          </FormControl>
          {session?.items.map((item) => (
            <Box
              key={item.videoName}
              sx={{ width: '100%', marginBottom: '15px' }}
            >
              <TextField
                fullWidth
                label={`Title: ${item.videoName}`}
                value={item.title}
                disabled={locked || Boolean(item.videoId)}
                error={Boolean(getVideoTitleError(item.title))}
                helperText={
                  getVideoTitleError(item.title) ||
                  `${[...item.title].length}/100`
                }
                onChange={(event) => {
                  item.title = event.target.value;
                  setSession({ ...session, items: [...session.items] });
                }}
              />
              {item.videoId && (
                <Typography variant="body2">
                  Video confirmed: {item.videoId}
                  {uploadComplete(item) ? ' (complete)' : ' (follow-up needed)'}
                </Typography>
              )}
              {item.error && <Alert severity="warning">{item.error}</Alert>}
            </Box>
          ))}
          {session?.items.length === 0 && (
            <Typography>No videos found.</Typography>
          )}
          <Button
            disabled={
              locked ||
              connection?.state !== 'connected' ||
              !session?.items.length ||
              complete ||
              Boolean(
                session?.channelId &&
                  session.channelId !== connection?.channel.id
              )
            }
            variant="contained"
            onClick={upload}
          >
            {session?.items.some((item) => item.videoId || item.error)
              ? 'Retry Failed Steps'
              : 'Upload'}
          </Button>
        </Box>
      </main>
    </AppShell>
  );
};

export default YTUploadView;
