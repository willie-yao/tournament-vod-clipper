import { CSSProperties, useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Alert, Button, Dialog, IconButton } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TuneIcon from '@mui/icons-material/Tune';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import CheckIcon from '@mui/icons-material/Check';
import UndoIcon from '@mui/icons-material/Undo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useLocation, useNavigate } from 'react-router-dom';
import { MuiColorInput } from 'mui-color-input';
import { VODMetadata } from '../common/tournamentSets';
import {
  ClipDraft,
  draftFor,
  draftChanged,
  draftError,
  thumbnailDraftError,
} from '../common/clipDraft';
import {
  formatClipTime,
  getClipRangeError,
  parseClipTime,
} from '../../common/clipTime';
import { getVideoTitleError, VideoFile } from '../../common/files';
import AppShell from '../common/AppShell';
import { heldBatch, holdBatch } from '../common/heldBatch';
import OutputFolder from '../common/OutputFolder';
import SnackbarPopup from '../common/SnackbarPopup';
import {
  DEFAULT_THUMBNAIL_COLOR,
  DEFAULT_THUMBNAIL_RIGHT_COLOR,
  exportThumbnail,
} from '../common/thumbnailDrawing';
import ThumbnailPreview from '../components/ThumbnailPreview';
import ThumbnailFields from '../components/ThumbnailFields';
import QueueMenu from '../components/QueueMenu';
import ClipFields from '../components/ClipFields';
import ClipRange from '../components/ClipRange';
import VodPlayer, { PlayerHandle, PlayerState } from '../components/VodPlayer';

export interface SetsState {
  sets: VODMetadata[];
  vodUrl: string;
  tournamentName: string;
  skippedSets: number;
  eventId?: string;
  station?: string;
}

export interface DownloadResult {
  file?: VideoFile;
  thumbnailReady: boolean;
  thumbnailKey?: string;
  error?: string;
}

export type BatchFilter = 'all' | 'ready' | 'exceptions';

export interface Workspace {
  inspectedId: string;
  layout: 'list' | 'grid';
  review: boolean;
}

interface ReviewTransition {
  finished: Promise<void>;
  skipTransition: () => void;
}

interface FieldColors {
  left: string;
  right: string;
}

// Edits closer together than this count as one undo step.
const COLOR_EDIT_GAP_MS = 800;
const COLOR_HISTORY_LIMIT = 50;
const SEEK_STEP = 10;
const APPLIED_MESSAGE = 'Changes applied. Batch selection is unchanged.';

function correctionFor(set: VODMetadata) {
  return (
    set.needsCorrection ||
    getClipRangeError(set.startTime, set.endTime) ||
    getVideoTitleError(set.title)
  );
}

function matchName(set: VODMetadata) {
  return `${set.player1} vs ${set.player2}`;
}

export default function SetsView() {
  const { state }: { state: SetsState | null } = useLocation();
  const navigate = useNavigate();
  const controlId = useId();
  const [restored] = useState(() => {
    const batch = heldBatch();
    return state && batch?.source === state ? batch : undefined;
  });
  const [sets, setSets] = useState(
    () =>
      restored?.sets ||
      (state?.sets || []).map((set) => ({
        ...set,
        download: set.download && !correctionFor(set),
      }))
  );
  const [workspace, setWorkspace] = useState<Workspace>(
    () =>
      restored?.workspace || {
        inspectedId: state?.sets[0]?.id || '',
        layout: 'list',
        review: false,
      }
  );
  const { inspectedId, layout, review } = workspace;
  const desiredWorkspace = useRef(workspace);
  const transition = useRef<ReviewTransition>();
  const mounted = useRef(true);
  const previousReview = useRef(false);
  const [linkedId, setLinkedId] = useState('');
  const [filter, setFilter] = useState<BatchFilter>(restored?.filter || 'all');
  const [search, setSearch] = useState(restored?.search || '');
  const [drafts, setDrafts] = useState<Record<string, ClipDraft>>(
    restored?.drafts || {}
  );
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeDownload, setActiveDownload] = useState<{
    key: string;
    title: string;
    stage: 'video' | 'thumbnail';
  }>();
  const [choosingOutput, setChoosingOutput] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [thumbnailColor, setThumbnailColor] = useState(
    restored?.thumbnailColor || DEFAULT_THUMBNAIL_COLOR
  );
  const [thumbnailRightColor, setThumbnailRightColor] = useState(
    restored?.thumbnailRightColor || DEFAULT_THUMBNAIL_RIGHT_COLOR
  );
  const [colorHistory, setColorHistory] = useState<FieldColors[]>([]);
  const lastColorEdit = useRef(0);
  const [thumbnailLogo, setThumbnailLogo] = useState(
    restored?.thumbnailLogo || ''
  );
  const [thumbnailBg, setThumbnailBg] = useState(restored?.thumbnailBg || '');
  const [downloadThumbnails, setDownloadThumbnails] = useState(
    restored?.downloadThumbnails ?? true
  );
  const [results, setResults] = useState<Record<string, DownloadResult>>(
    restored?.results || {}
  );
  const [summary, setSummary] = useState('');
  const [summarySuccess, setSummarySuccess] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState>({
    ready: false,
    time: 0,
    duration: 0,
    paused: true,
  });
  const [duration, setDuration] = useState<number>();
  const busyRef = useRef(false);
  const progress = useRef(
    new Map<string, DownloadResult>(Object.entries(restored?.results ?? {}))
  );
  const player = useRef<PlayerHandle>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const inputLogo = useRef<HTMLInputElement>(null);
  const inputBackground = useRef<HTMLInputElement>(null);
  const locked = busy || choosingOutput;
  const inspectedIndex = sets.findIndex((set) => set.id === inspectedId);
  const inspected = sets[inspectedIndex];
  const draft = inspected && (drafts[inspected.id] || draftFor(inspected));
  const currentError =
    draft && (draftError(draft, duration) || thumbnailDraftError(draft));
  const dirty = inspected && draft && draftChanged(inspected, draft);
  const thumbnailStyle = {
    color: thumbnailColor,
    rightColor: thumbnailRightColor,
    logo: thumbnailLogo,
    background: thumbnailBg,
  };
  const thumbnailKey = JSON.stringify([
    thumbnailColor,
    thumbnailRightColor,
    thumbnailLogo,
    thumbnailBg,
  ]);
  const atDefaultColors =
    thumbnailColor.toLowerCase() === DEFAULT_THUMBNAIL_COLOR.toLowerCase() &&
    thumbnailRightColor.toLowerCase() ===
      DEFAULT_THUMBNAIL_RIGHT_COLOR.toLowerCase();
  const rememberColors = () =>
    setColorHistory((history) => [
      ...history.slice(1 - COLOR_HISTORY_LIMIT),
      { left: thumbnailColor, right: thumbnailRightColor },
    ]);
  const editColor = (side: keyof FieldColors, value: string) => {
    const now = Date.now();
    if (now - lastColorEdit.current > COLOR_EDIT_GAP_MS) rememberColors();
    lastColorEdit.current = now;
    if (side === 'left') setThumbnailColor(value);
    else setThumbnailRightColor(value);
  };
  const resetColors = () => {
    rememberColors();
    lastColorEdit.current = 0;
    setThumbnailColor(DEFAULT_THUMBNAIL_COLOR);
    setThumbnailRightColor(DEFAULT_THUMBNAIL_RIGHT_COLOR);
  };
  const undoColors = () => {
    const previous = colorHistory[colorHistory.length - 1];
    if (!previous) return;
    setColorHistory((history) => history.slice(0, -1));
    lastColorEdit.current = 0;
    setThumbnailColor(previous.left);
    setThumbnailRightColor(previous.right);
  };
  const thumbnailKeyFor = (set: VODMetadata) =>
    JSON.stringify([
      thumbnailKey,
      set.player1,
      set.player2,
      set.character1,
      set.character2,
      set.roundText || '',
    ]);
  const resultKey = (set: VODMetadata) =>
    JSON.stringify([set.id, set.title, set.startTime, set.endTime]);
  const issue = (set: VODMetadata) =>
    correctionFor(set) ||
    (duration && set.endTime !== null && set.endTime > duration
      ? 'Out is beyond the VOD duration.'
      : null);
  const eligible = sets.filter((set) => !issue(set));
  const selected = sets.filter((set) => set.download);
  const selectedDirty = selected.some(
    (set) => drafts[set.id] && draftChanged(set, drafts[set.id])
  );
  const selectedInvalid = selected.some((set) => issue(set));
  const selectAllChecked =
    eligible.length > 0 && eligible.every((set) => set.download);
  const ready = (set: VODMetadata) => {
    const result = results[resultKey(set)];
    return Boolean(
      result?.file &&
        (!downloadThumbnails ||
          (result.thumbnailReady &&
            result.thumbnailKey === thumbnailKeyFor(set))) &&
        !result.error
    );
  };
  const allReady =
    selected.length > 0 &&
    !selectedDirty &&
    !selectedInvalid &&
    selected.every(ready);
  const pendingDraft = (set: VODMetadata) =>
    Boolean(drafts[set.id] && draftChanged(set, drafts[set.id]));
  const runPhase = (set: VODMetadata) => {
    if (activeDownload?.key === resultKey(set)) return activeDownload.stage;
    if (results[resultKey(set)]?.error) return 'error';
    if (pendingDraft(set)) return 'draft';
    if (ready(set)) return 'ready';
    if (busy && set.download) return 'queued';
    return undefined;
  };
  const runLabel = (set: VODMetadata) => {
    const phase = runPhase(set);
    return phase
      ? {
          video: 'Downloading clip',
          thumbnail: 'Saving thumbnail',
          error: 'Output failed',
          draft: 'Unapplied changes',
          ready: 'Downloaded',
          queued: 'Queued',
        }[phase]
      : undefined;
  };
  const readyCount = selected.filter(
    (set) => ready(set) && !pendingDraft(set) && !issue(set)
  ).length;
  const savedCount = selected.filter(
    (set) => results[resultKey(set)]?.file
  ).length;
  const hasProgress =
    busy || selected.some((set) => Boolean(results[resultKey(set)]));
  const enableDownload =
    !locked &&
    selected.length > 0 &&
    !selectedDirty &&
    !selectedInvalid &&
    !allReady;
  const filterLabels = {
    all: `All ${sets.length}`,
    ready: `Ready ${eligible.length}`,
    exceptions: `Exceptions ${sets.length - eligible.length}`,
  };
  let downloadLabel = `Download ${selected.length} clips`;
  if (selected.some((set) => results[resultKey(set)]?.error)) {
    downloadLabel = 'Retry incomplete clips';
  }
  if (busy) downloadLabel = 'Downloading...';
  const openVodFolder = async () => {
    if (!state) return;
    try {
      await window.electron.ipcRenderer.openFolder(state.tournamentName);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };
  const continueToUpload = () => {
    const files = selected
      .map((set) => results[resultKey(set)].file)
      .filter((file): file is VideoFile => Boolean(file));
    if (files.length !== selected.length) {
      setError(
        'Some clips are not ready. Retry incomplete clips before continuing.'
      );
      return;
    }
    navigate('/YTUploadView', {
      state: {
        folderName: files[0]?.folderName,
        videoNames: files.map((file) => file.videoName),
      },
    });
  };
  const selectedDuration = selected.reduce(
    (total, set) =>
      total + Math.max(0, (set.endTime || 0) - (set.startTime || 0)),
    0
  );
  const rangeExtent =
    duration ||
    Math.max(
      1,
      ...sets.map((set) => Math.max(set.startTime || 0, set.endTime || 0))
    );
  const visible = sets.filter((set) => {
    const matches = `${set.title} ${matchName(set)} ${set.roundText || ''}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return (
      matches &&
      (filter === 'all' ||
        (filter === 'ready' ? !issue(set) : Boolean(issue(set))))
    );
  });

  useEffect(() => {
    if (!state) return;
    holdBatch({
      source: state,
      sets,
      drafts,
      workspace,
      filter,
      search,
      results,
      downloadThumbnails,
      thumbnailColor,
      thumbnailRightColor,
      thumbnailLogo,
      thumbnailBg,
    });
  }, [
    state,
    sets,
    drafts,
    workspace,
    filter,
    search,
    results,
    downloadThumbnails,
    thumbnailColor,
    thumbnailRightColor,
    thumbnailLogo,
    thumbnailBg,
  ]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      transition.current?.skipTransition();
    };
  }, []);
  useEffect(() => {
    if (review) {
      reviewHeading.current?.focus({ preventScroll: true });
    } else if (previousReview.current) {
      inspectorHeading.current?.focus({ preventScroll: true });
    }
    previousReview.current = review;
  }, [review, inspectedId]);
  useEffect(() => {
    if (review) player.current?.seek(Math.max(0, inspected?.startTime || 0));
  }, [review, inspectedId, inspected?.startTime]);

  const changeWorkspace = (changes: Partial<Workspace>) => {
    if (busyRef.current || choosingOutput) return;
    desiredWorkspace.current = { ...desiredWorkspace.current, ...changes };
    setSavedMessage('');
    setLinkedId('');
    // Late transition callbacks must commit the newest navigation intent.
    const commit = () => {
      if (mounted.current && !busyRef.current)
        flushSync(() => setWorkspace(desiredWorkspace.current));
    };
    const previous = transition.current;
    transition.current = undefined;
    previous?.skipTransition();
    const host: Document & {
      startViewTransition?: (update: () => void) => ReviewTransition;
    } = document;
    if (
      previous ||
      !host.startViewTransition ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      commit();
      return;
    }
    try {
      const current = host.startViewTransition(commit);
      transition.current = current;
      current.finished
        .finally(() => {
          if (transition.current === current) transition.current = undefined;
        })
        .catch((failure: unknown) => {
          if (!(failure instanceof Error && failure.name === 'AbortError'))
            console.warn(
              'Review transition failed; using the current view.',
              failure
            );
        });
    } catch (failure) {
      console.warn(
        'Review transition unavailable; using the current view.',
        failure
      );
      commit();
    }
  };
  const updateDraft = (value: ClipDraft) => {
    if (!inspected || busyRef.current || locked) return;
    setDrafts((current) => ({ ...current, [inspected.id]: value }));
    setSavedMessage('');
    setSummary('');
  };
  const inspect = (id: string) => {
    changeWorkspace({ inspectedId: id });
  };
  const activateMatch = (id: string) => {
    changeWorkspace({
      inspectedId: id,
      review: desiredWorkspace.current.inspectedId === id,
    });
  };
  const stepReview = (step: number) => {
    const index = sets.findIndex(
      (set) => set.id === desiredWorkspace.current.inspectedId
    );
    if (sets[index + step]) inspect(sets[index + step].id);
  };
  const toggle = (id: string) => {
    if (busyRef.current || locked) return;
    setSets((current) =>
      current.map((set) =>
        set.id === id && (set.download || !issue(set))
          ? { ...set, download: !set.download }
          : set
      )
    );
    setSummary('');
  };
  const apply = () => {
    if (!inspected || !draft || currentError || locked) return;
    const startTime = parseClipTime(draft.start);
    const endTime = parseClipTime(draft.end);
    if (startTime === null || endTime === null) return;
    setSets((current) =>
      current.map((set) =>
        set.id === inspected.id
          ? {
              ...set,
              startTime,
              endTime,
              title: draft.title.trim(),
              player1: draft.player1.trim(),
              player2: draft.player2.trim(),
              character1: draft.character1.trim(),
              character2: draft.character2.trim(),
              roundText: draft.roundText.trim(),
              needsCorrection: null,
            }
          : set
      )
    );
    setDrafts((current) => {
      const next = { ...current };
      delete next[inspected.id];
      return next;
    });
    setSavedMessage(APPLIED_MESSAGE);
    setSummary('');
  };
  const backToBatch = () => {
    changeWorkspace({ review: false });
  };
  const status = (set: VODMetadata) => {
    const result = results[resultKey(set)];
    const failure = result?.error;
    const pending = drafts[set.id] && draftChanged(set, drafts[set.id]);
    const warning = issue(set);
    const phase = runPhase(set);
    const active =
      phase === 'video' || phase === 'thumbnail' || phase === 'queued';
    let text = ready(set) ? 'Downloaded' : 'Ready';
    let severity = '';
    let indicator = <CheckIcon />;
    if (phase === 'queued') text = 'Queued';
    if (warning || pending) {
      text = pending ? 'Unapplied changes' : warning || text;
      severity = 'warn';
      indicator = <WarningAmberIcon />;
    }
    if (failure) {
      text = result.file ? `Clip saved; thumbnail failed: ${failure}` : failure;
      severity = 'error';
      indicator = <WarningAmberIcon />;
    }
    if (active) {
      if (phase !== 'queued')
        text =
          phase === 'video' ? 'Downloading clip...' : 'Saving thumbnail...';
      severity = 'warn';
      indicator = <span className="run-marker" aria-hidden="true" />;
    }
    return (
      <span className={`clip-status ${severity}`}>
        {indicator}
        {text}
      </span>
    );
  };
  const recordResult = (key: string, result: DownloadResult) => {
    progress.current.set(key, result);
    setResults((current) => ({ ...current, [key]: { ...result } }));
  };
  const generateThumbnail = async (set: VODMetadata, file: VideoFile) => {
    const buf = await exportThumbnail(set, thumbnailStyle);
    await window.electron.ipcRenderer.saveThumbnail({
      ...file,
      buf,
    });
  };

  const download = async () => {
    if (busyRef.current || choosingOutput || !state) return;
    if (!selected.length || selectedDirty || selectedInvalid) {
      setError(
        'Select valid clips and apply their pending edits before downloading.'
      );
      return;
    }
    busyRef.current = true;
    desiredWorkspace.current = workspace;
    transition.current?.skipTransition();
    transition.current = undefined;
    setBusy(true);
    setSummary('');
    setError('');
    let completed = 0;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const set = selected[index];
        const key = resultKey(set);
        const result = progress.current.get(key) || { thumbnailReady: false };
        result.error = undefined;
        recordResult(key, result);
        try {
          if (!result.file) {
            setActiveDownload({ key, title: set.title, stage: 'video' });
            // eslint-disable-next-line no-await-in-loop
            result.file = await window.electron.ipcRenderer.downloadVideo({
              vodUrl: state.vodUrl,
              title: set.title,
              startTime: set.startTime,
              endTime: set.endTime,
              tournamentName: state.tournamentName,
            });
            recordResult(key, result);
          }
          if (
            downloadThumbnails &&
            (!result.thumbnailReady ||
              result.thumbnailKey !== thumbnailKeyFor(set))
          ) {
            setActiveDownload({ key, title: set.title, stage: 'thumbnail' });
            // eslint-disable-next-line no-await-in-loop
            await generateThumbnail(set, result.file);
            result.thumbnailReady = true;
            result.thumbnailKey = thumbnailKeyFor(set);
          }
          result.error = undefined;
          completed += 1;
        } catch (failure) {
          result.error =
            failure instanceof Error ? failure.message : String(failure);
        }
        recordResult(key, result);
      }
      setSummary(
        `${completed} of ${selected.length} selected clips ready.${
          completed !== selected.length ? ' Review failed items and retry.' : ''
        }`
      );
      setSummarySuccess(completed === selected.length);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setActiveDownload(undefined);
    }
  };

  const thumbnailControls = (
    <section className="thumbnail-section">
      <div className="thumbnail-head">
        <h3>Batch thumbnails</h3>
        <IconButton
          aria-label="Thumbnail & output options"
          title="Thumbnail & output options"
          disabled={locked}
          onClick={() => setOptionsOpen(true)}
        >
          <TuneIcon />
        </IconButton>
      </div>
      <label className="include-clip" htmlFor={`${controlId}-thumbnails`}>
        <input
          id={`${controlId}-thumbnails`}
          type="checkbox"
          checked={downloadThumbnails}
          disabled={locked}
          onChange={(event) => {
            setDownloadThumbnails(event.target.checked);
            setSummary('');
          }}
        />
        Generate thumbnails
      </label>
      {inspected && <ThumbnailPreview set={inspected} style={thumbnailStyle} />}
    </section>
  );

  return (
    <AppShell current="batch" locked={locked}>
      <div className="apply-toast">
        {SnackbarPopup(APPLIED_MESSAGE, 'success', Boolean(savedMessage), () =>
          setSavedMessage('')
        )}
      </div>
      {!state ? (
        <div className="empty-state">
          <h1>No batch loaded</h1>
          <p>Retrieve sets from a tournament to begin.</p>
          <Button onClick={() => navigate('/')}>Set up a source</Button>
        </div>
      ) : (
        <>
          {review && inspected ? (
            <header className="review-heading">
              <IconButton
                className="review-back"
                aria-label={`Back to ${
                  layout === 'list' ? 'list' : 'thumbnails'
                }`}
                title={`Back to ${layout === 'list' ? 'list' : 'thumbnails'}`}
                disabled={locked}
                onClick={backToBatch}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
              <div>
                <h1 ref={reviewHeading} tabIndex={-1}>
                  {matchName(inspected)}
                </h1>
                <p>
                  {inspected.roundText || 'Match'} · Set #{inspected.id}
                </p>
              </div>
              <nav className="review-pager" aria-label="Match navigation">
                <IconButton
                  aria-label="Previous"
                  title={
                    inspectedIndex > 0
                      ? matchName(sets[inspectedIndex - 1])
                      : undefined
                  }
                  disabled={locked || inspectedIndex <= 0}
                  onClick={() => stepReview(-1)}
                >
                  <ChevronLeftIcon />
                </IconButton>
                <QueueMenu
                  sets={sets}
                  currentId={inspected.id}
                  disabled={locked}
                  onSelect={inspect}
                />
                <IconButton
                  aria-label="Next"
                  title={
                    inspectedIndex < sets.length - 1
                      ? matchName(sets[inspectedIndex + 1])
                      : undefined
                  }
                  disabled={locked || inspectedIndex >= sets.length - 1}
                  onClick={() => stepReview(1)}
                >
                  <ChevronRightIcon />
                </IconButton>
              </nav>
            </header>
          ) : (
            <header className="app-heading">
              <div>
                <h1>{state.tournamentName}</h1>
                <p>
                  {state.eventId?.split('/event/')[1] || 'Tournament sets'} /{' '}
                  {state.station || 'Stream station'}
                  <span aria-hidden="true"> · </span>
                  <a href={state.vodUrl} target="_blank" rel="noreferrer">
                    Open source VOD ↗
                  </a>
                </p>
              </div>
            </header>
          )}
          <div className="batch-notices">
            {state.skippedSets > 0 && (
              <Alert severity="warning">
                {state.skippedSets} empty set records could not be retrieved.
              </Alert>
            )}
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            {summary && (
              <Alert
                role="status"
                severity={summarySuccess ? 'success' : 'warning'}
              >
                {summary}
              </Alert>
            )}
            {busy && (
              <Alert role="status" severity="info">
                {activeDownload?.stage === 'thumbnail'
                  ? 'Saving thumbnail'
                  : 'Downloading selected clips one at a time'}
                : {activeDownload?.title}
              </Alert>
            )}
          </div>
          {review && inspected && draft ? (
            <div className="review-layout">
              <main className="review-main">
                <div className="review-viewer">
                  <VodPlayer
                    ref={player}
                    url={state.vodUrl}
                    initialTime={Math.max(0, inspected.startTime || 0)}
                    onState={(value) => {
                      setPlayerState(value);
                      if (value.duration > 0) setDuration(value.duration);
                    }}
                  />
                </div>
                <div className="review-scrubber">
                  <output
                    className="mono playhead"
                    aria-label="Current playhead"
                  >
                    {formatClipTime(playerState.time)}
                  </output>
                  <input
                    type="range"
                    aria-label="Seek VOD"
                    min={0}
                    max={playerState.duration || rangeExtent}
                    step={1}
                    value={Math.min(
                      playerState.time,
                      playerState.duration || rangeExtent
                    )}
                    disabled={!playerState.ready || !playerState.duration}
                    onChange={(event) =>
                      player.current?.seek(Number(event.target.value))
                    }
                  />
                  <span className="mono">
                    {duration ? formatClipTime(duration) : 'Duration pending'}
                  </span>
                </div>
                <div className="review-transport">
                  <ClipFields
                    part="times"
                    iconButtons
                    id={`${controlId}-clip`}
                    draft={draft}
                    saved={draftFor(inspected)}
                    onChange={updateDraft}
                    disabled={locked}
                    duration={duration}
                    playhead={playerState.ready ? playerState.time : undefined}
                    playerReady={playerState.ready}
                    onSeek={(time) => player.current?.seek(time)}
                  />
                  <div
                    className="transport-controls"
                    role="group"
                    aria-label="Playback"
                  >
                    <IconButton
                      className="transport-step"
                      aria-label="Back 10 seconds"
                      title="Back 10 seconds"
                      disabled={!playerState.ready}
                      onClick={() =>
                        player.current?.seek(
                          Math.max(0, playerState.time - SEEK_STEP)
                        )
                      }
                    >
                      <ChevronLeftIcon />
                      <span className="mono">10s</span>
                    </IconButton>
                    <IconButton
                      className="transport-play"
                      aria-label={playerState.paused ? 'Play' : 'Pause'}
                      title={playerState.paused ? 'Play' : 'Pause'}
                      disabled={!playerState.ready}
                      onClick={() => player.current?.toggle()}
                    >
                      {playerState.paused ? <PlayArrowIcon /> : <PauseIcon />}
                    </IconButton>
                    <IconButton
                      className="transport-step"
                      aria-label="Forward 10 seconds"
                      title="Forward 10 seconds"
                      disabled={!playerState.ready}
                      onClick={() =>
                        player.current?.seek(
                          Math.min(
                            playerState.duration || Infinity,
                            playerState.time + SEEK_STEP
                          )
                        )
                      }
                    >
                      <span className="mono">10s</span>
                      <ChevronRightIcon />
                    </IconButton>
                  </div>
                </div>
                <section className="review-timeline" aria-label="Clip timeline">
                  <ClipRange
                    key={inspected.id}
                    saved={inspected}
                    draft={draft}
                    onChange={updateDraft}
                    disabled={locked}
                    duration={duration}
                  />
                  <details className="help-disclosure">
                    <summary>Timing help</summary>
                    <p>
                      Start.gg times are suggestions. Use the playhead controls
                      to set In and Out. Downloads use the native cutter and are
                      not guaranteed frame-accurate.
                    </p>
                  </details>
                </section>
              </main>
              <aside
                className="inspector review-inspector"
                aria-label="Clip review"
              >
                <ClipFields
                  part="title"
                  id={`${controlId}-clip`}
                  draft={draft}
                  originalTitle={inspected.originalTitle}
                  onChange={updateDraft}
                  disabled={locked}
                  duration={duration}
                />
                {inspected.needsCorrection && !dirty && (
                  <Alert severity="warning">{inspected.needsCorrection}</Alert>
                )}
                <label
                  className="include-clip"
                  htmlFor={`${controlId}-include`}
                >
                  <input
                    id={`${controlId}-include`}
                    type="checkbox"
                    aria-label={`Select ${inspected.title}`}
                    aria-describedby={
                      !inspected.download && dirty
                        ? `${controlId}-include-hint`
                        : undefined
                    }
                    checked={inspected.download}
                    disabled={
                      locked ||
                      (!inspected.download &&
                        (Boolean(issue(inspected)) ||
                          Boolean(currentError) ||
                          Boolean(dirty)))
                    }
                    onChange={() => toggle(inspected.id)}
                  />
                  <span>Include this clip in the batch</span>
                </label>
                {!inspected.download && dirty && (
                  <p id={`${controlId}-include-hint`} className="help">
                    Apply to clip before adding it back to the batch.
                  </p>
                )}
                <ThumbnailFields
                  set={inspected}
                  draft={draft}
                  style={thumbnailStyle}
                  onChange={updateDraft}
                  disabled={locked}
                />
              </aside>
            </div>
          ) : (
            <div className="desk">
              <main className="batch-center">
                <section className="ranges" aria-label="Saved clip ranges">
                  <div className="range-labels mono">
                    <span>00:00:00</span>
                    <span>{formatClipTime(rangeExtent / 2)}</span>
                    <span>{formatClipTime(rangeExtent)}</span>
                  </div>
                  <div className="range-track">
                    {sets
                      .filter(
                        (set) => set.startTime !== null && set.startTime >= 0
                      )
                      .map((set) => (
                        <button
                          key={set.id}
                          type="button"
                          aria-label={`Inspect range for ${set.title}${
                            runLabel(set) ? `, ${runLabel(set)}` : ''
                          }`}
                          aria-pressed={inspectedId === set.id}
                          disabled={locked}
                          data-run-state={runPhase(set)}
                          data-linked={linkedId === set.id || undefined}
                          title={runLabel(set)}
                          onPointerEnter={() => setLinkedId(set.id)}
                          onPointerLeave={() => setLinkedId('')}
                          onFocus={() => setLinkedId(set.id)}
                          onBlur={() => setLinkedId('')}
                          style={{
                            left: `${Math.min(
                              99,
                              ((set.startTime || 0) / rangeExtent) * 100
                            )}%`,
                            width: `${Math.max(
                              0.5,
                              Math.min(
                                100 -
                                  ((set.startTime || 0) / rangeExtent) * 100,
                                (Math.max(
                                  1,
                                  (set.endTime || set.startTime || 0) -
                                    (set.startTime || 0)
                                ) /
                                  rangeExtent) *
                                  100
                              )
                            )}%`,
                            borderStyle: issue(set) ? 'dashed' : 'solid',
                          }}
                          onClick={() => inspect(set.id)}
                        />
                      ))}
                  </div>
                </section>
                <div className="batch-toolbar">
                  <div className="batch-filters" aria-label="Filter matches">
                    {(['all', 'ready', 'exceptions'] as const).map((value) => (
                      <Button
                        key={value}
                        disabled={locked}
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                      >
                        {filterLabels[value]}
                      </Button>
                    ))}
                  </div>
                  <div className="view-switch" aria-label="Match layout">
                    <Button
                      startIcon={<ViewListIcon />}
                      disabled={locked}
                      aria-pressed={layout === 'list'}
                      onClick={() => changeWorkspace({ layout: 'list' })}
                    >
                      List
                    </Button>
                    <Button
                      startIcon={<GridViewIcon />}
                      disabled={locked}
                      aria-pressed={layout === 'grid'}
                      onClick={() => changeWorkspace({ layout: 'grid' })}
                    >
                      Thumbnails
                    </Button>
                  </div>
                  <label
                    className="search-field"
                    htmlFor={`${controlId}-search`}
                  >
                    <SearchIcon />
                    <input
                      id={`${controlId}-search`}
                      aria-label="Find player or title"
                      placeholder="Find player or title"
                      value={search}
                      disabled={locked}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                </div>
                {visible.length === 0 && (
                  <div className="empty-state">
                    <h2>
                      {sets.length ? 'No matching sets' : 'No sets found'}
                    </h2>
                    <p>
                      {sets.length
                        ? 'Try another player or title, or show all matches.'
                        : 'No matches were returned for this stream station. Check the tournament event and station, then retrieve again.'}
                    </p>
                    {sets.length ? (
                      <Button
                        onClick={() => {
                          setFilter('all');
                          setSearch('');
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button disabled={locked} onClick={() => navigate('/')}>
                        Change source
                      </Button>
                    )}
                  </div>
                )}
                {visible.length > 0 && layout === 'list' && (
                  <div className="table-scroll">
                    <table className="match-table">
                      <thead>
                        <tr>
                          <th>
                            <input
                              type="checkbox"
                              aria-label="Select all valid clips"
                              checked={selectAllChecked}
                              disabled={locked || !eligible.length}
                              onChange={() => {
                                setSets((current) =>
                                  current.map((set) => ({
                                    ...set,
                                    download: !selectAllChecked && !issue(set),
                                  }))
                                );
                                setSummary('');
                              }}
                            />
                          </th>
                          <th>Match / output title</th>
                          <th className="range-column">IN → OUT</th>
                          <th className="length-column">Length</th>
                          <th className="state-column">Cut state</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((set) => (
                          <tr
                            key={set.id}
                            className={`${
                              inspectedId === set.id ? 'focused' : ''
                            } ${issue(set) ? 'exception' : ''}`}
                            data-run-state={runPhase(set)}
                            data-linked={linkedId === set.id || undefined}
                            onPointerEnter={() => setLinkedId(set.id)}
                            onPointerLeave={() => setLinkedId('')}
                          >
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${set.title}`}
                                checked={set.download}
                                disabled={
                                  locked ||
                                  (!set.download && Boolean(issue(set)))
                                }
                                onChange={() => toggle(set.id)}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="inspect-button"
                                aria-label={`${
                                  inspectedId === set.id ? 'Review' : 'Inspect'
                                } ${set.title}`}
                                disabled={locked}
                                onFocus={() => setLinkedId(set.id)}
                                onBlur={() => setLinkedId('')}
                                onClick={() => activateMatch(set.id)}
                              >
                                {matchName(set)}
                                <span className="match-title" title={set.title}>
                                  {set.title}
                                </span>
                              </button>
                            </td>
                            <td className="mono match-range">
                              {formatClipTime(set.startTime) || 'Missing In'} →{' '}
                              {formatClipTime(set.endTime) || 'Missing Out'}
                            </td>
                            <td className="mono length-column">
                              {!issue(set)
                                ? formatClipTime(
                                    (set.endTime || 0) - (set.startTime || 0)
                                  )
                                : '-'}
                            </td>
                            <td>{status(set)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {visible.length > 0 && layout === 'grid' && (
                  <div className="thumbnail-grid">
                    {visible.map((set) => (
                      <article
                        key={set.id}
                        className={`match-card ${
                          inspectedId === set.id ? 'focused' : ''
                        } ${issue(set) ? 'exception' : ''}`}
                        data-run-state={runPhase(set)}
                        data-linked={linkedId === set.id || undefined}
                        onPointerEnter={() => setLinkedId(set.id)}
                        onPointerLeave={() => setLinkedId('')}
                      >
                        <div className="card-check">
                          <input
                            type="checkbox"
                            aria-label={`Select ${set.title}`}
                            checked={set.download}
                            disabled={
                              locked || (!set.download && Boolean(issue(set)))
                            }
                            onChange={() => toggle(set.id)}
                          />
                        </div>
                        <button
                          type="button"
                          className="thumbnail-inspect"
                          aria-label={`${
                            inspectedId === set.id ? 'Review' : 'Inspect'
                          } ${set.title}`}
                          disabled={locked}
                          onFocus={() => setLinkedId(set.id)}
                          onBlur={() => setLinkedId('')}
                          onClick={() => activateMatch(set.id)}
                        >
                          <ThumbnailPreview set={set} style={thumbnailStyle} />
                        </button>
                        <div className="card-meta">
                          <button
                            type="button"
                            className="inspect-button"
                            aria-label={`${
                              inspectedId === set.id ? 'Review' : 'Inspect'
                            } match ${set.title}`}
                            disabled={locked}
                            onFocus={() => setLinkedId(set.id)}
                            onBlur={() => setLinkedId('')}
                            onClick={() => activateMatch(set.id)}
                          >
                            {matchName(set)}
                            <span className="match-title" title={set.title}>
                              {set.title}
                            </span>
                          </button>
                          <div className="card-range mono">
                            {formatClipTime(set.startTime) || 'Missing In'} →{' '}
                            {formatClipTime(set.endTime) || 'Missing Out'}
                          </div>
                          <div className="card-bottom">
                            {status(set)}
                            <Button
                              disabled={locked}
                              onClick={() =>
                                changeWorkspace({
                                  inspectedId: set.id,
                                  review: true,
                                })
                              }
                            >
                              Review ↗
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </main>
              <aside className="inspector" aria-label="Inspected match">
                {inspected && draft ? (
                  <>
                    <div className="inspector-label">
                      <span>Inspected set</span>
                      <span className="mono">#{inspected.id}</span>
                    </div>
                    <h2
                      className="inspector-title"
                      ref={inspectorHeading}
                      tabIndex={-1}
                    >
                      {matchName(inspected)}
                    </h2>
                    <p className="help">{inspected.roundText || 'Match'}</p>
                    {status(inspected)}
                    <ClipFields
                      draft={draft}
                      saved={draftFor(inspected)}
                      originalTitle={inspected.originalTitle}
                      onChange={updateDraft}
                      disabled={locked}
                      duration={duration}
                    />
                    {inspected.needsCorrection && !dirty && (
                      <Alert severity="warning">
                        {inspected.needsCorrection}
                      </Alert>
                    )}
                    <Button
                      fullWidth
                      variant="outlined"
                      disabled={
                        locked ||
                        Boolean(currentError) ||
                        (!dirty && !inspected.needsCorrection)
                      }
                      onClick={apply}
                    >
                      Apply to clip
                    </Button>
                    <Button
                      className="review-action"
                      variant="outlined"
                      fullWidth
                      disabled={locked}
                      onClick={() => changeWorkspace({ review: true })}
                    >
                      Review clip & timestamps →
                    </Button>
                    <hr className="section-rule" />
                    {thumbnailControls}
                  </>
                ) : (
                  <p className="help">
                    Retrieved matches will appear here for inspection.
                  </p>
                )}
              </aside>
            </div>
          )}
          <footer className="batch-footer">
            {hasProgress && (
              <div className="batch-progress-strip" aria-hidden="true">
                {selected.map((set) => (
                  <span key={set.id} data-run-state={runPhase(set)} />
                ))}
              </div>
            )}
            <div>
              <h2>
                {review
                  ? `${selected.length} clips remain selected in the batch`
                  : `${selected.length} clips in this batch`}
              </h2>
              {selected.length > 0 && !selectedDirty && !selectedInvalid && (
                <p className="help">
                  {formatClipTime(selectedDuration)} selected
                </p>
              )}
              {hasProgress && (
                <p className="help output-summary">
                  {readyCount} of {selected.length} ready · {savedCount} clip
                  files saved
                </p>
              )}
            </div>
            <div className="batch-actions">
              {review ? (
                <>
                  <button
                    type="button"
                    className="batch-tool"
                    aria-label="Back to batch"
                    title="Back to batch"
                    onClick={backToBatch}
                  >
                    <ArrowBackIcon />
                  </button>
                  <button
                    type="button"
                    className="batch-command"
                    disabled={
                      locked ||
                      Boolean(currentError) ||
                      (!dirty && !inspected?.needsCorrection)
                    }
                    onClick={apply}
                  >
                    <span className="batch-command-label">Apply to clip</span>
                    <span className="batch-command-go">
                      <CheckIcon />
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="batch-tool"
                    aria-label="Output options"
                    title="Output options"
                    disabled={locked}
                    onClick={() => setOptionsOpen(true)}
                  >
                    <TuneIcon />
                  </button>
                  <button
                    type="button"
                    className="batch-tool"
                    aria-label="Open VOD Folder"
                    title="Open VOD Folder"
                    disabled={locked || !allReady}
                    onClick={openVodFolder}
                  >
                    <FolderOpenIcon />
                  </button>
                  {allReady ? (
                    <button
                      type="button"
                      className="batch-command"
                      data-ready="true"
                      disabled={locked}
                      onClick={continueToUpload}
                    >
                      <span key="upload" className="batch-command-label">
                        Continue to Upload
                      </span>
                      <span className="batch-command-go">
                        <ArrowForwardIcon />
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="batch-command"
                      data-busy={busy}
                      disabled={!enableDownload}
                      onClick={download}
                      style={
                        {
                          '--batch-done': selected.length
                            ? readyCount / selected.length
                            : 0,
                        } as CSSProperties
                      }
                    >
                      <span key="download" className="batch-command-label">
                        {downloadLabel}
                      </span>
                      <span className="batch-command-go">
                        <DownloadIcon />
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          </footer>
          <Dialog
            open={optionsOpen}
            keepMounted
            onClose={() => {
              if (!locked) setOptionsOpen(false);
            }}
            aria-labelledby="output-options-title"
          >
            <div className="settings-body settings-preview-first">
              <div className="settings-head">
                <h2 id="output-options-title">Thumbnail & output options</h2>
                <label
                  className="settings-switch"
                  htmlFor={`${controlId}-options-thumbnails`}
                >
                  <input
                    id={`${controlId}-options-thumbnails`}
                    type="checkbox"
                    checked={downloadThumbnails}
                    disabled={locked}
                    onChange={(event) =>
                      setDownloadThumbnails(event.target.checked)
                    }
                  />
                  Generate thumbnails
                </label>
              </div>
              <div className="settings-workbench">
                {inspected && (
                  <figure className="settings-preview">
                    <ThumbnailPreview set={inspected} style={thumbnailStyle} />
                    <figcaption>
                      <span>
                        {downloadThumbnails
                          ? '1280 × 720 JPEG'
                          : 'Preview only · thumbnails off'}
                      </span>
                    </figcaption>
                  </figure>
                )}
                <div className="settings-colors">
                  <div
                    className="settings-color"
                    style={{ '--field': thumbnailColor } as React.CSSProperties}
                  >
                    <MuiColorInput
                      label="Left field color"
                      value={thumbnailColor}
                      onChange={(value) => editColor('left', value)}
                      disabled={locked}
                    />
                  </div>
                  <div
                    className="settings-color"
                    style={
                      { '--field': thumbnailRightColor } as React.CSSProperties
                    }
                  >
                    <MuiColorInput
                      label="Right field color"
                      value={thumbnailRightColor}
                      onChange={(value) => editColor('right', value)}
                      disabled={locked}
                    />
                  </div>
                  <div className="settings-color-tools">
                    <Button
                      size="small"
                      startIcon={<UndoIcon />}
                      disabled={locked || colorHistory.length === 0}
                      onClick={undoColors}
                    >
                      Undo
                    </Button>
                    <Button
                      size="small"
                      startIcon={<RestartAltIcon />}
                      disabled={locked || atDefaultColors}
                      title="Reset both field colors to default"
                      onClick={resetColors}
                    >
                      Reset to default
                    </Button>
                  </div>
                </div>
              </div>
              <div className="settings-rows">
                <div className="settings-row">
                  <div className="settings-info">
                    <strong>Header logo</strong>
                    <p>
                      {thumbnailLogo
                        ? 'Custom logo selected'
                        : 'Optional · tournament header'}
                    </p>
                  </div>
                  <Button
                    variant="outlined"
                    disabled={locked}
                    onClick={() => inputLogo.current?.click()}
                  >
                    Select logo
                  </Button>
                  <Button
                    disabled={locked || !thumbnailLogo}
                    onClick={() => {
                      URL.revokeObjectURL(thumbnailLogo);
                      setThumbnailLogo('');
                    }}
                  >
                    Remove logo
                  </Button>
                </div>
                <div className="settings-row">
                  <div className="settings-info">
                    <strong>Background image</strong>
                    <p>
                      {thumbnailBg
                        ? 'Custom background selected'
                        : 'Optional · behind both portraits'}
                    </p>
                  </div>
                  <Button
                    variant="outlined"
                    disabled={locked}
                    onClick={() => inputBackground.current?.click()}
                  >
                    Select background image
                  </Button>
                  <Button
                    disabled={locked || !thumbnailBg}
                    onClick={() => {
                      URL.revokeObjectURL(thumbnailBg);
                      setThumbnailBg('');
                    }}
                  >
                    Remove background
                  </Button>
                </div>
                <OutputFolder
                  disabled={locked}
                  onChoosingChange={setChoosingOutput}
                  onChange={() => {
                    progress.current.clear();
                    setResults({});
                    setSummary('');
                  }}
                />
              </div>
              <input
                ref={inputLogo}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    if (thumbnailLogo) URL.revokeObjectURL(thumbnailLogo);
                    setThumbnailLogo(URL.createObjectURL(file));
                  }
                  event.target.value = '';
                }}
              />
              <input
                ref={inputBackground}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    if (thumbnailBg) URL.revokeObjectURL(thumbnailBg);
                    setThumbnailBg(URL.createObjectURL(file));
                  }
                  event.target.value = '';
                }}
              />
              <Button
                className="settings-done"
                disabled={locked}
                variant="contained"
                onClick={() => setOptionsOpen(false)}
              >
                Done
              </Button>
            </div>
          </Dialog>
        </>
      )}
    </AppShell>
  );
}
