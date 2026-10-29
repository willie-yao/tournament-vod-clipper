import {
  Button,
  Container,
  Checkbox,
  Fab,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  FormGroup,
  FormControlLabel,
  Alert,
  IconButton,
  Box,
  Dialog,
  Switch,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useLocation, useNavigate } from 'react-router-dom';
import React, { useState, useRef } from 'react';
import { VODMetadata } from 'renderer/common/tournamentSets';
import SnackbarPopup from 'renderer/common/SnackbarPopup';
import ThumbnailGenerator from 'renderer/components/ThumbnailGenerator';
import EditTimestampModal from 'renderer/components/EditTimestampModal';
import { MuiColorInput } from 'mui-color-input';
import html2canvas from 'html2canvas';
import { Buffer } from 'buffer';
import { formatClipTime, getClipRangeError } from '../../common/clipTime';
import { VideoFile } from '../../common/files';
import OutputFolder from '../common/OutputFolder';

interface SetsState {
  sets: VODMetadata[];
  vodUrl: string;
  tournamentName: string;
  skippedSets: number;
}

function correctionFor(set: VODMetadata) {
  return set.needsCorrection || getClipRangeError(set.startTime, set.endTime);
}

interface DownloadResult {
  file?: VideoFile;
  thumbnailReady: boolean;
  thumbnailKey?: string;
  error?: string;
}

const SetsView = () => {
  const { state }: { state: SetsState } = useLocation();
  const navigate = useNavigate();
  const [sets, setSets] = useState(state.sets);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [choosingOutput, setChoosingOutput] = useState(false);
  const locked = busy || choosingOutput;
  const busyRef = useRef(false);
  const progress = useRef(new Map<string, DownloadResult>());
  const [results, setResults] = useState<Record<string, DownloadResult>>({});
  const [summary, setSummary] = useState('');
  const [summarySuccess, setSummarySuccess] = useState(false);
  const [thumbnailModalOpen, setThumbnailModalOpen] = useState(false);
  const [thumbnailColor, setThumbnailColor] = useState('#B9F3FC');
  const [thumbnailLogo, setThumbnailLogo] = useState('');
  const [thumbnailBg, setThumbnailBg] = useState('');
  const [downloadThumbnails, setDownloadThumbnails] = useState(true);
  const inputFile = React.useRef<HTMLInputElement | null>(null);
  const inputBgFile = React.useRef<HTMLInputElement | null>(null);
  const eligible = sets.filter((set) => !correctionFor(set));
  const selectAllChecked =
    eligible.length > 0 && eligible.every((set) => set.download);
  const selected = sets.filter((set) => set.download);
  const resultKey = (set: VODMetadata) =>
    JSON.stringify([set.id, set.title, set.startTime, set.endTime]);
  const thumbnailKey = JSON.stringify([
    thumbnailColor,
    thumbnailLogo,
    thumbnailBg,
  ]);
  const ready = (set: VODMetadata) => {
    const result = results[resultKey(set)];
    return Boolean(
      result?.file &&
        (!downloadThumbnails ||
          (result.thumbnailReady && result.thumbnailKey === thumbnailKey)) &&
        !result.error
    );
  };
  const allReady = selected.length > 0 && selected.every(ready);
  const enableDownload =
    !locked &&
    selected.length > 0 &&
    !allReady &&
    selected.every((set) => !correctionFor(set));

  const handleSelectAll = () => {
    setSets((current) =>
      current.map((set) => ({
        ...set,
        download: !selectAllChecked && !correctionFor(set),
      }))
    );
  };

  const handleToggle = (index: number) => {
    setSets((current) =>
      current.map((set, i) =>
        i === index && !correctionFor(set)
          ? { ...set, download: !set.download }
          : set
      )
    );
  };

  const thumbnailOptionsModal = (
    <Dialog
      open={thumbnailModalOpen}
      onClose={() => setThumbnailModalOpen(false)}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '80vh',
          minWidth: '50vw',
          padding: '20px',
        }}
      >
        <Typography variant="h6" component="h2" textAlign="center" gutterBottom>
          Thumbnail Options
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={downloadThumbnails}
                onChange={(event) =>
                  setDownloadThumbnails(event.target.checked)
                }
              />
            }
            label="Download Thumbnails"
          />
        </FormGroup>
        <MuiColorInput
          label="Background Color"
          value={thumbnailColor}
          onChange={setThumbnailColor}
        />
        <Button
          variant="contained"
          color="secondary"
          sx={{ width: '50%', color: 'white' }}
          onClick={() => inputFile.current?.click()}
        >
          Select Logo
        </Button>
        <input
          type="file"
          accept="image/*"
          ref={inputFile}
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setThumbnailLogo(URL.createObjectURL(file));
          }}
        />
        <Button
          variant="contained"
          color="secondary"
          sx={{ width: '50%', color: 'white' }}
          onClick={() => inputBgFile.current?.click()}
        >
          Select BG Image
        </Button>
        <input
          type="file"
          accept="image/*"
          ref={inputBgFile}
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setThumbnailBg(URL.createObjectURL(file));
          }}
        />
        <Box sx={{ width: '426px', height: '240px', overflow: 'hidden' }}>
          <ThumbnailGenerator
            logo={thumbnailLogo}
            bgImage={thumbnailBg}
            bgColor={thumbnailColor}
            scale="0.335"
            character1="Hero"
            character2="Kirby"
          />
        </Box>
      </Box>
    </Dialog>
  );

  const generateThumbnail = async (set: VODMetadata, file: VideoFile) => {
    const thumbnail = document.getElementById(`thumbnail-${set.id}`);
    if (!thumbnail) throw new Error('The thumbnail preview is unavailable.');
    const canvas = await html2canvas(thumbnail);
    const base64 = canvas
      .toDataURL('image/jpeg')
      .replace(/^data:image\/jpeg;base64,/, '');
    await window.electron.ipcRenderer.saveThumbnail({
      ...file,
      buf: Buffer.from(base64, 'base64'),
    });
  };

  const download = async () => {
    if (busyRef.current || choosingOutput) return;
    const invalid = selected.map(correctionFor).find(Boolean);
    if (!selected.length || invalid) {
      setErrorMessage(invalid || 'Select at least one valid set.');
      setErrorOpen(true);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setSummary('');
    let completed = 0;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const set = selected[index];
        const key = resultKey(set);
        const result = progress.current.get(key) || { thumbnailReady: false };
        try {
          if (!result.file) {
            // eslint-disable-next-line no-await-in-loop
            result.file = await window.electron.ipcRenderer.downloadVideo({
              vodUrl: state.vodUrl,
              title: set.title,
              startTime: set.startTime,
              endTime: set.endTime,
              tournamentName: state.tournamentName,
            });
          }
          if (
            downloadThumbnails &&
            (!result.thumbnailReady || result.thumbnailKey !== thumbnailKey)
          ) {
            // eslint-disable-next-line no-await-in-loop
            await generateThumbnail(set, result.file);
            result.thumbnailReady = true;
            result.thumbnailKey = thumbnailKey;
          }
          result.error = undefined;
          completed += 1;
        } catch (failure) {
          result.error =
            failure instanceof Error ? failure.message : String(failure);
        }
        progress.current.set(key, result);
        setResults((current) => ({ ...current, [key]: { ...result } }));
      }
      setSummary(
        `${completed} of ${selected.length} selected clips ready.${
          completed !== selected.length ? ' Review failed items and retry.' : ''
        }`
      );
      setSummarySuccess(completed === selected.length);
    } catch (failure) {
      setErrorMessage(
        failure instanceof Error ? failure.message : String(failure)
      );
      setErrorOpen(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Container
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {SnackbarPopup(errorMessage, 'error', errorOpen, setErrorOpen)}
      <OutputFolder
        disabled={locked}
        onChoosingChange={setChoosingOutput}
        onChange={() => {
          progress.current.clear();
          setResults({});
          setSummary('');
        }}
      />
      {summary && (
        <Alert severity={summarySuccess ? 'success' : 'warning'}>
          {summary}
        </Alert>
      )}
      {busy && (
        <Alert severity="info">
          Downloading selected clips one at a time...
        </Alert>
      )}
      <Fab
        sx={{ position: 'fixed', left: '20px', top: '20px' }}
        color="secondary"
        aria-label="back"
        size="medium"
        disabled={locked}
        onClick={() => navigate('/')}
      >
        <ArrowBackIcon />
      </Fab>
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
        Select Sets to Download
      </Typography>
      {state.skippedSets > 0 && (
        <Alert severity="warning">
          {state.skippedSets} empty set records could not be retrieved.
        </Alert>
      )}
      {thumbnailOptionsModal}
      {editingIndex !== null && (
        <EditTimestampModal
          set={sets[editingIndex]}
          vodUrl={state.vodUrl}
          onClose={() => setEditingIndex(null)}
          onSave={(startTime, endTime, title) => {
            setSets((current) =>
              current.map((set, index) =>
                index === editingIndex
                  ? {
                      ...set,
                      startTime,
                      endTime,
                      title,
                      needsCorrection: null,
                      download: Boolean(correctionFor(set)) || set.download,
                    }
                  : set
              )
            );
            setEditingIndex(null);
          }}
        />
      )}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}
      >
        <FormGroup>
          <Button
            variant="contained"
            disabled={locked}
            color="secondary"
            sx={{ width: '40vw', marginBottom: '20px' }}
            onClick={handleSelectAll}
          >
            <FormControlLabel
              sx={{ color: 'white' }}
              control={
                <Checkbox
                  checked={selectAllChecked}
                  disabled={locked}
                  disableRipple
                />
              }
              label="Select All"
            />
          </Button>
        </FormGroup>
        <Button
          variant="contained"
          disabled={locked}
          color="secondary"
          sx={{ width: '40vw', marginBottom: '20px', color: 'white' }}
          onClick={() => setThumbnailModalOpen(true)}
        >
          Thumbnail Options
        </Button>
      </Box>
      <List
        className="list-box"
        sx={{
          minWidth: '100%',
          minHeight: '50vh',
          '&::-webkit-scrollbar': { width: '0.4em' },
          '&::-webkit-scrollbar-track': {
            boxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)',
            webkitBoxShadow: 'inset 0 0 6px rgba(0,0,0,0.00)',
          },
          '&::-webkit-scrollbar-thumb': {
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,.1)',
            outline: '1px solid slategrey',
          },
        }}
      >
        {sets.length === 0 && (
          <Typography
            sx={{ marginTop: '23vh' }}
            variant="h6"
            component="h2"
            textAlign="center"
            gutterBottom
          >
            No sets found
          </Typography>
        )}
        {sets.map((set, index) => (
          <ListItem key={set.id}>
            <ListItemButton
              disableRipple
              disabled={locked}
              sx={{ borderRadius: '5px' }}
              onClick={() => handleToggle(index)}
            >
              <ListItemIcon>
                <Checkbox
                  edge="start"
                  checked={set.download}
                  disabled={locked || Boolean(correctionFor(set))}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>
              <ListItemText
                primary={set.title}
                secondary={
                  results[resultKey(set)]?.error ||
                  (correctionFor(set)
                    ? `Needs correction: ${correctionFor(set)}`
                    : `${formatClipTime(set.startTime)} - ${formatClipTime(
                        set.endTime
                      )}`)
                }
              />
              <IconButton
                aria-label={`Edit ${set.title}`}
                disabled={locked}
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingIndex(index);
                }}
              >
                <EditIcon />
              </IconButton>
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-around', width: '100%' }}
      >
        <Button
          disabled={!enableDownload}
          variant="contained"
          color="secondary"
          sx={{ width: '27vw', marginTop: '20px', color: 'white' }}
          onClick={download}
        >
          Download VODs
        </Button>
        <Button
          disabled={locked || !allReady}
          variant="contained"
          color="secondary"
          sx={{ width: '27vw', marginTop: '20px', color: 'white' }}
          onClick={async () => {
            try {
              await window.electron.ipcRenderer.openFolder(
                state.tournamentName
              );
            } catch (failure) {
              setErrorMessage(
                failure instanceof Error ? failure.message : String(failure)
              );
              setErrorOpen(true);
            }
          }}
        >
          Open VOD Folder
        </Button>
        <Button
          disabled={locked || !allReady}
          variant="contained"
          color="secondary"
          sx={{ width: '27vw', marginTop: '20px', color: 'white' }}
          onClick={() => {
            const files = selected.map((set) => results[resultKey(set)].file);
            navigate('/YTUploadView', {
              state: {
                folderName: files[0]?.folderName,
                videoNames: files.map((file) => file?.videoName),
              },
            });
          }}
        >
          Continue to Upload
        </Button>
      </Box>
      <Box sx={{ position: 'relative', overflow: 'hidden' }}>
        <Box
          sx={{
            position: 'absolute',
            width: '1280px',
            height: '720px',
            right: '-640px',
            top: '360',
            overflow: 'hidden',
            zIndex: '-999',
          }}
        >
          {sets.map((set) => (
            <ThumbnailGenerator
              key={set.id + thumbnailColor}
              bgImage={thumbnailBg}
              bgColor={thumbnailColor}
              logo={thumbnailLogo}
              player1={set.player1}
              player2={set.player2}
              character1={set.character1}
              character2={set.character2}
              bottomText={set.tournamentName}
              title={`thumbnail-${set.id}`}
            />
          ))}
        </Box>
      </Box>
    </Container>
  );
};

export default SetsView;
