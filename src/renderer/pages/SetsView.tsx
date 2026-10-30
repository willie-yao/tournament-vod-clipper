import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, Dialog, LinearProgress } from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import CheckIcon from '@mui/icons-material/Check';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useLocation, useNavigate } from 'react-router-dom';
import { MuiColorInput } from 'mui-color-input';
import { VODMetadata } from '../common/tournamentSets';
import {
  ClipDraft,
  draftFor,
  draftChanged,
  draftError,
} from '../common/clipDraft';
import {
  formatClipTime,
  getClipRangeError,
  parseClipTime,
} from '../../common/clipTime';
import { getVideoTitleError, VideoFile } from '../../common/files';
import AppShell from '../common/AppShell';
import OutputFolder from '../common/OutputFolder';
import {
  DEFAULT_THUMBNAIL_COLOR,
  exportThumbnail,
} from '../common/thumbnailDrawing';
import ThumbnailPreview from '../components/ThumbnailPreview';
import ClipFields from '../components/ClipFields';
import VodPlayer, { PlayerHandle, PlayerState } from '../components/VodPlayer';

export interface SetsState {
  sets: VODMetadata[];
  vodUrl: string;
  tournamentName: string;
  skippedSets: number;
  eventId?: string;
  station?: string;
}

interface DownloadResult {
  file?: VideoFile;
  thumbnailReady: boolean;
  thumbnailKey?: string;
  error?: string;
}

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
  const [sets, setSets] = useState(() =>
    (state?.sets || []).map((set) => ({
      ...set,
      download: set.download && !correctionFor(set),
    }))
  );
  const [inspectedId, setInspectedId] = useState(state?.sets[0]?.id || '');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const [filter, setFilter] = useState<'all' | 'ready' | 'exceptions'>('all');
  const [search, setSearch] = useState('');
  const [review, setReview] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ClipDraft>>({});
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeTitle, setActiveTitle] = useState('');
  const [choosingOutput, setChoosingOutput] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [thumbnailColor, setThumbnailColor] = useState(DEFAULT_THUMBNAIL_COLOR);
  const [thumbnailLogo, setThumbnailLogo] = useState('');
  const [thumbnailBg, setThumbnailBg] = useState('');
  const [downloadThumbnails, setDownloadThumbnails] = useState(true);
  const [results, setResults] = useState<Record<string, DownloadResult>>({});
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
  const progress = useRef(new Map<string, DownloadResult>());
  const player = useRef<PlayerHandle>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const inputLogo = useRef<HTMLInputElement>(null);
  const inputBackground = useRef<HTMLInputElement>(null);
  const locked = busy || choosingOutput;
  const inspectedIndex = sets.findIndex((set) => set.id === inspectedId);
  const inspected = sets[inspectedIndex];
  const draft = inspected && (drafts[inspected.id] || draftFor(inspected));
  const currentError = draft && draftError(draft, duration);
  const dirty = inspected && draft && draftChanged(inspected, draft);
  const thumbnailStyle = {
    color: thumbnailColor,
    logo: thumbnailLogo,
    background: thumbnailBg,
  };
  const thumbnailKey = JSON.stringify([
    thumbnailColor,
    thumbnailLogo,
    thumbnailBg,
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
          (result.thumbnailReady && result.thumbnailKey === thumbnailKey)) &&
        !result.error
    );
  };
  const allReady =
    selected.length > 0 &&
    !selectedDirty &&
    !selectedInvalid &&
    selected.every(ready);
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

  useEffect(
    () => () => {
      if (thumbnailLogo) URL.revokeObjectURL(thumbnailLogo);
    },
    [thumbnailLogo]
  );
  useEffect(
    () => () => {
      if (thumbnailBg) URL.revokeObjectURL(thumbnailBg);
    },
    [thumbnailBg]
  );
  useEffect(() => {
    if (review) {
      reviewHeading.current?.focus({ preventScroll: true });
      player.current?.seek(Math.max(0, inspected?.startTime || 0));
    }
  }, [review, inspectedId, inspected?.startTime]);

  const updateDraft = (value: ClipDraft) => {
    if (!inspected || locked) return;
    setDrafts((current) => ({ ...current, [inspected.id]: value }));
    setSavedMessage('');
    setSummary('');
  };
  const inspect = (id: string) => {
    setInspectedId(id);
    setSavedMessage('');
  };
  const toggle = (id: string) => {
    if (locked) return;
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
    setSavedMessage('Changes applied. Batch selection is unchanged.');
    setSummary('');
  };
  const backToBatch = () => {
    setReview(false);
    setSavedMessage('');
    requestAnimationFrame(() =>
      inspectorHeading.current?.focus({ preventScroll: true })
    );
  };
  const status = (set: VODMetadata) => {
    const failure = results[resultKey(set)]?.error;
    const pending = drafts[set.id] && draftChanged(set, drafts[set.id]);
    const warning = issue(set);
    const text =
      failure ||
      (pending ? 'Unapplied changes' : warning) ||
      (ready(set) ? 'Downloaded' : 'Ready');
    let severity = '';
    if (warning || pending) severity = 'warn';
    if (failure) severity = 'error';
    return (
      <span className={`clip-status ${severity}`}>
        {failure || warning || pending ? <WarningAmberIcon /> : <CheckIcon />}
        {text}
      </span>
    );
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
    setBusy(true);
    setSummary('');
    setError('');
    let completed = 0;
    try {
      for (let index = 0; index < selected.length; index += 1) {
        const set = selected[index];
        setActiveTitle(set.title);
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
    } finally {
      busyRef.current = false;
      setBusy(false);
      setActiveTitle('');
    }
  };

  const thumbnailControls = (
    <section className="thumbnail-section">
      <h3>Batch thumbnails</h3>
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
        Create thumbnails for the batch
      </label>
      {inspected && <ThumbnailPreview set={inspected} style={thumbnailStyle} />}
      <Button disabled={locked} onClick={() => setOptionsOpen(true)}>
        Thumbnail & output options
      </Button>
    </section>
  );

  return (
    <AppShell current="batch" locked={locked}>
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
              <Button variant="outlined" onClick={backToBatch}>
                Back to {layout === 'list' ? 'list' : 'thumbnails'}
              </Button>
              <div>
                <h1 ref={reviewHeading} tabIndex={-1}>
                  {matchName(inspected)}
                </h1>
                <p>
                  {inspected.roundText || 'Match'} · Set #{inspected.id} ·
                  Timestamp review
                </p>
              </div>
              <div className="review-navigation">
                <Button
                  variant="outlined"
                  disabled={inspectedIndex <= 0}
                  onClick={() => inspect(sets[inspectedIndex - 1].id)}
                >
                  Previous
                </Button>
                <span>
                  {inspectedIndex + 1} / {sets.length}
                </span>
                <Button
                  variant="outlined"
                  disabled={inspectedIndex >= sets.length - 1}
                  onClick={() => inspect(sets[inspectedIndex + 1].id)}
                >
                  Next
                </Button>
              </div>
            </header>
          ) : (
            <header className="app-heading">
              <div>
                <h1>{state.tournamentName}</h1>
                <p>
                  {state.eventId?.split('/event/')[1] || 'Tournament sets'} /{' '}
                  {state.station || 'Stream station'} / Single VOD
                </p>
              </div>
              <div className="heading-stats">
                <strong>{eligible.length} valid ranges</strong> /{' '}
                {sets.length - eligible.length} need correction
                <br />
                <span className="mono">{formatClipTime(rangeExtent)}</span>{' '}
                {duration ? 'source duration' : 'last reported boundary'}
              </div>
            </header>
          )}
          <div className="batch-notices" aria-live="polite">
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
              <Alert severity={summarySuccess ? 'success' : 'warning'}>
                {summary}
              </Alert>
            )}
            {busy && (
              <>
                <Alert severity="info">
                  Downloading selected clips one at a time: {activeTitle}
                </Alert>
                <LinearProgress />
              </>
            )}
          </div>
          {review && inspected && draft ? (
            <div className="review-layout">
              <main className="review-main">
                <VodPlayer
                  ref={player}
                  url={state.vodUrl}
                  initialTime={Math.max(0, inspected.startTime || 0)}
                  onState={(value) => {
                    setPlayerState(value);
                    if (value.duration > 0) setDuration(value.duration);
                  }}
                />
                <div className="playback-tools">
                  <Button
                    variant="outlined"
                    disabled={!playerState.ready}
                    onClick={() => player.current?.toggle()}
                  >
                    {playerState.paused ? 'Play' : 'Pause'}
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!playerState.ready}
                    onClick={() =>
                      player.current?.seek(Math.max(0, playerState.time - 1))
                    }
                  >
                    -1s
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!playerState.ready}
                    onClick={() =>
                      player.current?.seek(
                        Math.min(
                          playerState.duration || Infinity,
                          playerState.time + 1
                        )
                      )
                    }
                  >
                    +1s
                  </Button>
                  <output
                    className="mono playhead"
                    aria-label="Current playhead"
                  >
                    {formatClipTime(playerState.time)}
                  </output>
                  <span className="help mono">
                    / {duration ? formatClipTime(duration) : 'Duration pending'}
                  </span>
                </div>
                <section className="review-timeline">
                  <h2>VOD playhead</h2>
                  <div className="range-labels mono">
                    <span>00:00:00</span>
                    <span>
                      {duration
                        ? formatClipTime(duration)
                        : 'Waiting for VOD duration'}
                    </span>
                  </div>
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
                  <div className="range-summary mono">
                    <span>
                      {draft.start || 'Missing In'} →{' '}
                      {draft.end || 'Missing Out'}
                    </span>
                    <span>
                      {!currentError
                        ? `${formatClipTime(
                            (parseClipTime(draft.end) || 0) -
                              (parseClipTime(draft.start) || 0)
                          )} clip`
                        : 'Range needs correction'}
                    </span>
                  </div>
                  <p className="help">
                    Watch the VOD, seek to a boundary, then copy the playhead to
                    In or Out. Start.gg times are suggestions. Downloads use the
                    existing native cutter and are not guaranteed
                    frame-accurate.
                  </p>
                </section>
              </main>
              <aside
                className="inspector review-inspector"
                aria-label="Clip review"
              >
                <h2>Clip boundaries</h2>
                <p className="help">
                  Verify where the match actually begins and ends before
                  applying.
                </p>
                <ClipFields
                  draft={draft}
                  onChange={updateDraft}
                  disabled={locked}
                  duration={duration}
                  playhead={playerState.ready ? playerState.time : undefined}
                  playerReady={playerState.ready}
                  onSeek={(time) => player.current?.seek(time)}
                />
                {inspected.needsCorrection && !dirty && (
                  <Alert severity="warning">{inspected.needsCorrection}</Alert>
                )}
                {savedMessage && (
                  <Alert severity="success">{savedMessage}</Alert>
                )}
                <label
                  className="include-clip"
                  htmlFor={`${controlId}-include`}
                >
                  <input
                    id={`${controlId}-include`}
                    type="checkbox"
                    aria-label={`Select ${inspected.title}`}
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
                  <span>
                    Include this clip in the batch
                    <br />
                    <span className="help">
                      Selection is separate from inspection.
                    </span>
                  </span>
                </label>
                {thumbnailControls}
              </aside>
            </div>
          ) : (
            <div className="desk">
              <aside className="source-bin">
                <section>
                  <h2>
                    <FolderOutlinedIcon fontSize="small" />
                    Source bin
                  </h2>
                  <div className="source-tree">
                    <p>{state.tournamentName}</p>
                    <p>{state.station || 'Stream station'}</p>
                    <a href={state.vodUrl} target="_blank" rel="noreferrer">
                      Open source VOD ↗
                    </a>
                  </div>
                </section>
                <section>
                  <h2>{duration ? 'VOD duration' : 'Reported range'}</h2>
                  <p className="mono">{formatClipTime(rangeExtent)}</p>
                  <p>
                    Inspect a set, then review the VOD to verify its boundaries.
                  </p>
                </section>
                <section className="bin-output">
                  <h2>
                    <FolderOutlinedIcon fontSize="small" />
                    Local output
                  </h2>
                  <p>
                    Only checked, valid clips enter this batch. List and
                    thumbnails share the same selection.
                  </p>
                  <Button
                    disabled={locked}
                    onClick={() => setOptionsOpen(true)}
                  >
                    Output options
                  </Button>
                </section>
              </aside>
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
                          aria-label={`Inspect range for ${set.title}`}
                          aria-pressed={inspectedId === set.id}
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
                  <div className="range-caption">
                    <span>
                      Saved ranges · click to inspect, then review the clip
                    </span>
                    <span>{sets.length - eligible.length} need correction</span>
                  </div>
                </section>
                <div className="batch-toolbar">
                  <div className="batch-filters" aria-label="Filter matches">
                    {(['all', 'ready', 'exceptions'] as const).map((value) => (
                      <Button
                        key={value}
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
                      aria-pressed={layout === 'list'}
                      onClick={() => setLayout('list')}
                    >
                      List
                    </Button>
                    <Button
                      startIcon={<GridViewIcon />}
                      aria-pressed={layout === 'grid'}
                      onClick={() => setLayout('grid')}
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
                          <th>IN → OUT</th>
                          <th className="length-column">Length</th>
                          <th>Cut state</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((set) => (
                          <tr
                            key={set.id}
                            className={`${
                              inspectedId === set.id ? 'focused' : ''
                            } ${issue(set) ? 'exception' : ''}`}
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
                                aria-label={`Inspect ${set.title}`}
                                onClick={() => inspect(set.id)}
                              >
                                {matchName(set)}
                              </button>
                              <span className="match-title" title={set.title}>
                                {set.title}
                              </span>
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
                          aria-label={`Inspect ${set.title}`}
                          onClick={() => inspect(set.id)}
                        >
                          <ThumbnailPreview set={set} style={thumbnailStyle} />
                        </button>
                        <div className="card-meta">
                          <button
                            type="button"
                            className="inspect-button"
                            onClick={() => inspect(set.id)}
                          >
                            {matchName(set)}
                          </button>
                          <span className="match-title" title={set.title}>
                            {set.title}
                          </span>
                          <div className="card-range mono">
                            {formatClipTime(set.startTime) || 'Missing In'} →{' '}
                            {formatClipTime(set.endTime) || 'Missing Out'}
                          </div>
                          <div className="card-bottom">
                            {status(set)}
                            <Button
                              onClick={() => {
                                inspect(set.id);
                                setReview(true);
                              }}
                            >
                              Review ↗
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <p className="table-note">
                  Inspecting does not change selection. Only checked, valid
                  clips enter the batch; unapplied edits stay with each set.
                </p>
              </main>
              <aside className="inspector" aria-label="Inspected match">
                {inspected && draft ? (
                  <>
                    <div className="inspector-label">
                      <span>Inspected set</span>
                      <span className="mono">#{inspected.id}</span>
                    </div>
                    <h2 ref={inspectorHeading} tabIndex={-1}>
                      {matchName(inspected)}
                    </h2>
                    <p className="help">{inspected.roundText || 'Match'}</p>
                    {status(inspected)}
                    <Button
                      className="review-action"
                      variant="contained"
                      fullWidth
                      disabled={locked}
                      onClick={() => setReview(true)}
                    >
                      Review clip & timestamps →
                    </Button>
                    <ClipFields
                      draft={draft}
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
                    {savedMessage && (
                      <Alert severity="success">{savedMessage}</Alert>
                    )}
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
            <span className="batch-count">{selected.length}</span>
            <div>
              <h2>
                {review
                  ? `${selected.length} clips remain selected in the batch`
                  : `${selected.length} clips in this batch`}
              </h2>
              <p className="help">
                {selectedDirty &&
                  'Apply pending edits to selected clips before downloading.'}
                {!selectedDirty &&
                  selectedInvalid &&
                  'Correct invalid selected ranges before downloading.'}
                {!selectedDirty &&
                  !selectedInvalid &&
                  `${formatClipTime(selectedDuration)} selected · ${
                    downloadThumbnails ? 'thumbnails included' : 'video only'
                  }`}
              </p>
            </div>
            <div className="batch-actions">
              {review ? (
                <>
                  <Button variant="outlined" onClick={backToBatch}>
                    Back to batch
                  </Button>
                  <Button
                    variant="contained"
                    disabled={
                      locked ||
                      Boolean(currentError) ||
                      (!dirty && !inspected?.needsCorrection)
                    }
                    onClick={apply}
                  >
                    Apply to clip
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    disabled={locked}
                    onClick={() => setOptionsOpen(true)}
                  >
                    Output options
                  </Button>
                  <Button
                    disabled={locked || !allReady}
                    onClick={async () => {
                      try {
                        await window.electron.ipcRenderer.openFolder(
                          state.tournamentName
                        );
                      } catch (failure) {
                        setError(
                          failure instanceof Error
                            ? failure.message
                            : String(failure)
                        );
                      }
                    }}
                  >
                    Open VOD Folder
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={locked || !allReady}
                    onClick={() => {
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
                    }}
                  >
                    Continue to Upload
                  </Button>
                  <Button
                    variant="contained"
                    disabled={!enableDownload}
                    onClick={download}
                  >
                    {downloadLabel} →
                  </Button>
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
            <div className="settings-body">
              <h2 id="output-options-title">Thumbnail & output options</h2>
              <OutputFolder
                disabled={locked}
                onChoosingChange={setChoosingOutput}
                onChange={() => {
                  progress.current.clear();
                  setResults({});
                  setSummary('');
                }}
              />
              <label
                className="include-clip"
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
                Create thumbnails for the batch
              </label>
              <MuiColorInput
                label="Left portrait color"
                value={thumbnailColor}
                onChange={setThumbnailColor}
                disabled={locked}
              />
              <div className="image-actions">
                <Button
                  variant="outlined"
                  disabled={locked}
                  onClick={() => inputLogo.current?.click()}
                >
                  Select logo
                </Button>
                <Button
                  disabled={locked || !thumbnailLogo}
                  onClick={() => setThumbnailLogo('')}
                >
                  Remove logo
                </Button>
                <Button
                  variant="outlined"
                  disabled={locked}
                  onClick={() => inputBackground.current?.click()}
                >
                  Select background image
                </Button>
                <Button
                  disabled={locked || !thumbnailBg}
                  onClick={() => setThumbnailBg('')}
                >
                  Remove background
                </Button>
              </div>
              <p className="help">
                Offset Duel keeps a warm opposing field. Custom backgrounds sit
                behind both portraits; your logo appears in the header.
              </p>
              <input
                ref={inputLogo}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setThumbnailLogo(URL.createObjectURL(file));
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
                  if (file) setThumbnailBg(URL.createObjectURL(file));
                  event.target.value = '';
                }}
              />
              {inspected && (
                <ThumbnailPreview set={inspected} style={thumbnailStyle} />
              )}
              <Button
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
