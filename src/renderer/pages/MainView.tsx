import { useState, useEffect, useRef } from 'react';
import { Alert, Button, TextField, MenuItem } from '@mui/material';
import { useApolloClient } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import SnackbarPopup from 'renderer/common/SnackbarPopup';
import { GET_ALL_CHARACTERS } from '../common/StartggQueries';
import {
  CharacterMap,
  TitleFormat,
  VODMetadata,
  PLAYERS_FIRST_TITLE,
  TOURNAMENT_FIRST_TITLE,
  retrieveTournamentSets,
  formatSetMetadata,
} from '../common/tournamentSets';
import AppShell from '../common/AppShell';
import EventField from '../components/EventField';
import OutputStrip from '../components/OutputStrip';
import { normalizeEventSlug, normalizeVodUrl } from '../common/sourceInput';
import startggRequest from '../common/startggRequest';
import {
  createRetrievalScope,
  RetrievalError,
  RETRIEVAL_TIMEOUT_MS,
  VOD_METADATA_TIMEOUT_MS,
  withRetrievalAbort,
} from '../../common/retrieval';

interface CharactersResponse {
  videogame: { characters: { id: number; name: string }[] | null } | null;
}

/** Section heading with a one-line summary of what the section has set. */
const Slate = ({ title, status }: { title: string; status: string }) => {
  const previous = useRef(status);
  const [wipe, setWipe] = useState(false);
  useEffect(() => {
    // Replacing a value wipes the new one in; first values just appear.
    if (previous.current && status && previous.current !== status)
      setWipe(true);
    previous.current = status;
  }, [status]);
  return (
    <header className="source-slate">
      <h2>{title}</h2>
      {status && (
        <span
          className={`source-slate-status${wipe ? ' is-wipe' : ''}`}
          key={status}
          title={status}
          onAnimationEnd={() => setWipe(false)}
        >
          {status}
        </span>
      )}
    </header>
  );
};

interface SearchProps {
  choosingOutput: boolean;
  onChoosingOutput: (choosing: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}

const VideoSearch = ({
  choosingOutput,
  onChoosingOutput,
  onBusyChange,
}: SearchProps) => {
  const client = useApolloClient();
  const navigate = useNavigate();
  const [vodUrl, setVodUrl] = useState(() =>
    String(window.electron.store.get('vodUrl') || '')
  );
  const [eventId, setEventId] = useState(() =>
    String(window.electron.store.get('eventId') || '')
  );
  const [station, setStation] = useState(() =>
    String(window.electron.store.get('station') || '')
  );
  // Restored values show their errors immediately; edits wait for blur.
  const [eventTouched, setEventTouched] = useState(() => eventId !== '');
  const [vodTouched, setVodTouched] = useState(() => vodUrl !== '');
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const [eventPick, setEventPick] = useState<{
    slug: string;
    label: string;
  } | null>(null);
  const [outputStatus, setOutputStatus] = useState('');
  const keyField = useRef<HTMLInputElement>(null);
  const changeKeyButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<'key' | 'change' | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const activeRetrieval = useRef<{
    requestId: string;
    scope: ReturnType<typeof createRetrievalScope>;
  } | null>(null);
  const [titleFormat, setTitleFormat] =
    useState<TitleFormat>(PLAYERS_FIRST_TITLE);
  const [keyError, setKeyError] = useState('');
  const [retrievalError, setRetrievalError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const eventSlug = normalizeEventSlug(eventId);
  const vodLink = normalizeVodUrl(vodUrl);
  const slugInvalid = eventId.trim() !== '' && !eventSlug;
  const urlInvalid = vodUrl.trim() !== '' && !vodLink;
  const slugError = eventTouched && slugInvalid;
  const urlError = vodTouched && urlInvalid;
  const disabled =
    !settingsReady ||
    savingKey ||
    choosingOutput ||
    waiting ||
    !apiKey ||
    keyDraft.trim() !== apiKey ||
    !eventSlug ||
    !vodLink ||
    !station.trim();
  let blockedReason = '';
  if (!settingsReady) blockedReason = 'Loading saved settings...';
  else if (!apiKey) blockedReason = 'Save a start.gg API key to retrieve sets.';
  else if (keyDraft.trim() !== apiKey)
    blockedReason = 'Save API key changes before retrieving sets.';
  else if (urlError || slugError)
    blockedReason = 'Correct the highlighted source fields.';
  else if (slugInvalid)
    blockedReason = 'Pick an event from the search or paste its start.gg link.';
  else if (urlInvalid)
    blockedReason = 'Use a Twitch VOD link such as twitch.tv/videos/123456789.';

  let accessStatus = '';
  if (settingsReady && keyDraft.trim() !== apiKey)
    accessStatus = 'Unsaved change';
  else if (settingsReady && apiKey) accessStatus = 'Key saved';
  let sourceStatus = '';
  if (eventSlug)
    sourceStatus =
      eventPick?.slug === eventSlug
        ? eventPick.label
        : eventSlug.replace(/^tournament\//, '').replace('/event/', ' · ');

  useEffect(
    () => onBusyChange(waiting || savingKey),
    [waiting, savingKey, onBusyChange]
  );

  useEffect(() => {
    const cancel = () => {
      const active = activeRetrieval.current;
      activeRetrieval.current = null;
      active?.scope.cancel();
    };
    window.addEventListener('pagehide', cancel);
    return () => {
      window.removeEventListener('pagehide', cancel);
      cancel();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadKey = async () => {
      try {
        const key = await window.electron.store.getSecret('apikey');
        if (active) {
          setApiKey(key);
          setKeyDraft(key);
          if (!key) pendingFocus.current = 'key';
        }
      } catch (error) {
        if (active) {
          setKeyError(
            `Error loading settings: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } finally {
        if (active) setSettingsReady(true);
      }
    };
    loadKey();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (pendingFocus.current === 'key') keyField.current?.focus();
    else if (pendingFocus.current === 'change')
      changeKeyButton.current?.focus();
    pendingFocus.current = null;
  });

  const saveKey = async () => {
    setSavingKey(true);
    setKeyError('');
    try {
      const key = keyDraft.trim();
      await window.electron.store.setSecret('apikey', key);
      setApiKey(key);
      setKeyDraft(key);
      setEditingKey(false);
      pendingFocus.current = key ? 'change' : 'key';
      setInfoMessage(key ? 'API key saved.' : 'API key removed.');
      setInfoOpen(true);
    } catch (error) {
      setKeyError(
        `Error saving API key: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setSavingKey(false);
    }
  };

  const editKey = (editing: boolean) => {
    setKeyDraft(apiKey);
    setKeyError('');
    setEditingKey(editing);
    pendingFocus.current = editing ? 'key' : 'change';
  };

  const retrieveSets = async () => {
    if (disabled || !eventSlug || !vodLink || activeRetrieval.current) return;
    const scope = createRetrievalScope(
      RETRIEVAL_TIMEOUT_MS,
      'Retrieval exceeded five minutes. Check your connection and retry.'
    );
    const requestId = crypto.randomUUID();
    const active = { requestId, scope };
    activeRetrieval.current = active;
    const cancelMetadata = () =>
      window.electron.ipcRenderer.cancelRetrieveVideoInformation(requestId);
    setWaiting(true);
    setRetrievalError('');
    setEventId(eventSlug);
    setVodUrl(vodLink);
    try {
      window.electron.store.set('eventId', eventSlug);
      window.electron.store.set('station', station.trim());
      window.electron.store.set('vodUrl', vodLink);
      const result = await retrieveTournamentSets(
        client,
        eventSlug,
        station.trim(),
        scope.signal
      );
      let sets: VODMetadata[] = [];
      if (result.sets.length) {
        let characterMap: CharacterMap =
          window.electron.store.get('characterMap');
        if (!characterMap) {
          const { data } = await startggRequest<CharactersResponse>(
            client,
            {
              query: GET_ALL_CHARACTERS,
              variables: { gameid: 1386 },
            },
            scope.signal
          );
          if (activeRetrieval.current !== active || scope.signal.aborted)
            return;
          characterMap = {};
          (data.videogame?.characters ?? []).forEach((character) => {
            characterMap[character.id] = character.name;
          });
          window.electron.store.set('characterMap', characterMap);
        }
        const metadataScope = createRetrievalScope(
          VOD_METADATA_TIMEOUT_MS,
          'VOD metadata did not respond within 60 seconds. Check the VOD URL and connection, then retry.',
          scope.signal
        );
        metadataScope.signal.addEventListener('abort', cancelMetadata, {
          once: true,
        });
        let timestamp: number;
        try {
          const response = await withRetrievalAbort(metadataScope.signal, () =>
            window.electron.ipcRenderer.retrieveVideoInformation({
              vodUrl: vodLink,
              requestId,
            })
          );
          if ('error' in response) throw new RetrievalError(response.error);
          timestamp = response.timestamp;
        } finally {
          metadataScope.signal.removeEventListener('abort', cancelMetadata);
          metadataScope.dispose();
        }
        sets = result.sets.map((set) =>
          formatSetMetadata(
            set,
            result.tournamentName,
            timestamp,
            characterMap,
            titleFormat,
            result.eventName
          )
        );
      }
      if (activeRetrieval.current !== active || scope.signal.aborted) return;
      navigate('/SetsView', {
        state: {
          sets,
          vodUrl: vodLink,
          tournamentName: result.tournamentName,
          skippedSets: result.skippedSets,
          eventId: eventSlug,
          station: station.trim(),
        },
      });
    } catch (error) {
      if (activeRetrieval.current !== active) return;
      setRetrievalError(
        `Error retrieving sets: ${
          error instanceof RetrievalError
            ? error.message
            : 'Retrieval failed. Check your source settings and connection, then retry.'
        }`
      );
    } finally {
      scope.dispose();
      if (activeRetrieval.current === active) {
        activeRetrieval.current = null;
        setWaiting(false);
      }
    }
  };

  const sourceFields = (
    <>
      <EventField
        value={eventId}
        onChange={(value) => {
          setEventId(value);
          setEventTouched(false);
          setRetrievalError('');
        }}
        onBlur={() => {
          if (eventSlug && eventSlug !== eventId) setEventId(eventSlug);
          setEventTouched(true);
        }}
        error={
          slugError
            ? 'Paste a start.gg event link or pick a search result.'
            : undefined
        }
        disabled={waiting || choosingOutput}
        apiKey={keyDraft.trim() === apiKey ? apiKey : ''}
        onPick={(slug, label) => setEventPick({ slug, label })}
      />
      <TextField
        error={urlError}
        className="textfield"
        label="VOD Link"
        required
        variant="outlined"
        value={vodUrl}
        onChange={(event) => {
          setVodUrl(event.target.value);
          setVodTouched(false);
          setRetrievalError('');
        }}
        onBlur={() => {
          if (vodLink && vodLink !== vodUrl) setVodUrl(vodLink);
          setVodTouched(true);
        }}
        disabled={waiting || choosingOutput}
        placeholder="https://www.twitch.tv/videos/123456789"
        helperText={
          urlError
            ? 'Use a Twitch VOD link such as twitch.tv/videos/123456789.'
            : undefined
        }
      />
      <TextField
        className="textfield"
        label="Stream Station"
        required
        variant="outlined"
        value={station}
        onChange={(event) => {
          setStation(event.target.value);
          setRetrievalError('');
        }}
        disabled={waiting || choosingOutput}
        placeholder="Twitch channel name or station number"
      />
      <TextField
        value={titleFormat}
        label="Video Title Format"
        variant="outlined"
        disabled={waiting || choosingOutput}
        select
        onChange={(event) => {
          const { value } = event.target;
          if (value === PLAYERS_FIRST_TITLE || value === TOURNAMENT_FIRST_TITLE)
            setTitleFormat(value);
        }}
      >
        <MenuItem value={PLAYERS_FIRST_TITLE}>{PLAYERS_FIRST_TITLE}</MenuItem>
        <MenuItem value={TOURNAMENT_FIRST_TITLE}>
          {TOURNAMENT_FIRST_TITLE}
        </MenuItem>
      </TextField>
      <details className="help-disclosure">
        <summary>Source format examples</summary>
        <p>
          Search tournaments by name once an API key is saved, or paste a
          start.gg event link such as{' '}
          <code>start.gg/tournament/name/event/name</code>. The VOD link is a
          Twitch video such as <code>twitch.tv/videos/123456789</code>. Stream
          Station accepts a Twitch channel name or station number.
        </p>
      </details>
    </>
  );
  const sourceAction = (
    <>
      <Button
        variant="contained"
        disabled={disabled}
        aria-describedby={
          blockedReason && !waiting ? 'source-requirements' : undefined
        }
        onClick={retrieveSets}
      >
        {waiting ? 'Retrieving sets...' : 'Retrieve Sets'}
      </Button>
      {retrievalError && !waiting && (
        <Alert severity="error">{retrievalError}</Alert>
      )}
      {blockedReason && !waiting && (
        <p className="help" id="source-requirements" role="status">
          {blockedReason}
        </p>
      )}
      {waiting && (
        <div className="loading-sets" role="status">
          <p className="help">Retrieving sets and VOD start time...</p>
          <div className="splice-scan" aria-hidden="true">
            <span className="splice-scan-draft" />
          </div>
          <Button onClick={() => activeRetrieval.current?.scope.cancel()}>
            Cancel retrieval
          </Button>
        </div>
      )}
    </>
  );
  const keyBusy = !settingsReady || savingKey || waiting || choosingOutput;
  const accessFields =
    apiKey && !editingKey ? (
      <div className="key-saved">
        <p>Encrypted on this device</p>
        <Button
          ref={changeKeyButton}
          disabled={keyBusy}
          onClick={() => editKey(true)}
        >
          Change
        </Button>
      </div>
    ) : (
      <div className="source-access-fields">
        <TextField
          required
          type="password"
          label="Start.gg API key"
          variant="outlined"
          value={keyDraft}
          inputRef={keyField}
          onChange={(event) => setKeyDraft(event.target.value)}
          disabled={keyBusy}
        />
        <div className="key-actions">
          <Button
            variant="outlined"
            disabled={keyBusy || keyDraft.trim() === apiKey}
            onClick={saveKey}
          >
            {savingKey ? 'Saving API key...' : 'Save API Key'}
          </Button>
          {apiKey && (
            <Button disabled={savingKey} onClick={() => editKey(false)}>
              Cancel
            </Button>
          )}
        </div>
        <details className="help-disclosure" open={!apiKey}>
          <summary>API key help</summary>
          <p>
            Create a personal token in your{' '}
            <a
              href="https://start.gg/admin/profile/developer"
              target="_blank"
              rel="noreferrer"
            >
              start.gg developer settings
            </a>
            . Save it here before retrieving sets. The key is encrypted on this
            device.
          </p>
        </details>
      </div>
    );
  const outputFolder = (
    <OutputStrip
      disabled={waiting || savingKey}
      onChoosingChange={onChoosingOutput}
      onStatusChange={setOutputStatus}
    />
  );

  return (
    <div className="source-form">
      {SnackbarPopup(infoMessage, 'info', infoOpen, setInfoOpen)}
      <section className="source-access" aria-label="Start.gg access">
        <Slate title="Start.gg access" status={accessStatus} />
        {accessFields}
        {keyError && <Alert severity="error">{keyError}</Alert>}
      </section>
      <section className="source-inputs" aria-label="Tournament source">
        <Slate title="Match source" status={sourceStatus} />
        <div className="source-fields">{sourceFields}</div>
      </section>
      <aside className="source-settings" aria-label="Source settings">
        <Slate title="Output" status={outputStatus} />
        {outputFolder}
      </aside>
      <div className="source-submit">{sourceAction}</div>
    </div>
  );
};

const MainView = () => {
  const [choosingOutput, setChoosingOutput] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AppShell current="source" locked={choosingOutput || busy}>
      <main className="source-page">
        <div className="source-intro">
          <h1>Tournament source</h1>
        </div>
        <VideoSearch
          choosingOutput={choosingOutput}
          onChoosingOutput={setChoosingOutput}
          onBusyChange={setBusy}
        />
      </main>
    </AppShell>
  );
};

export default MainView;
