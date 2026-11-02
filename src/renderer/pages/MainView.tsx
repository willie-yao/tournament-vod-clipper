import { useState, useEffect } from 'react';
import { Button, TextField, MenuItem, LinearProgress } from '@mui/material';
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
import OutputFolder from '../common/OutputFolder';

interface CharactersResponse {
  videogame: { characters: { id: number; name: string }[] | null } | null;
}

function isValidURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

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
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [settingsReady, setSettingsReady] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [titleFormat, setTitleFormat] =
    useState<TitleFormat>(PLAYERS_FIRST_TITLE);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);
  const urlError = vodUrl !== '' && !isValidURL(vodUrl.trim());
  const slugError =
    eventId !== '' &&
    !/^tournament\/[\w-]+\/event\/[\w-]+$/.test(eventId.trim());
  const disabled =
    !settingsReady ||
    savingKey ||
    choosingOutput ||
    waiting ||
    !apiKey ||
    keyDraft.trim() !== apiKey ||
    !eventId.trim() ||
    !vodUrl.trim() ||
    !station.trim() ||
    urlError ||
    slugError;
  let blockedReason = '';
  if (!settingsReady) blockedReason = 'Loading saved settings...';
  else if (!apiKey) blockedReason = 'Save a start.gg API key to retrieve sets.';
  else if (keyDraft.trim() !== apiKey)
    blockedReason = 'Save API key changes before retrieving sets.';
  else if (urlError || slugError)
    blockedReason = 'Correct the highlighted source fields.';
  else if (!eventId.trim() || !vodUrl.trim() || !station.trim())
    blockedReason = 'Enter the event slug, VOD link and stream station.';

  useEffect(
    () => onBusyChange(waiting || savingKey),
    [waiting, savingKey, onBusyChange]
  );

  useEffect(() => {
    let active = true;
    const loadKey = async () => {
      try {
        const key = await window.electron.store.getSecret('apikey');
        if (active) {
          setApiKey(key);
          setKeyDraft(key);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            `Error loading settings: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          setErrorOpen(true);
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

  const saveKey = async () => {
    setSavingKey(true);
    try {
      const key = keyDraft.trim();
      await window.electron.store.setSecret('apikey', key);
      setApiKey(key);
      setKeyDraft(key);
      setInfoMessage(key ? 'API key saved.' : 'API key removed.');
      setInfoOpen(true);
    } catch (error) {
      setErrorMessage(
        `Error saving API key: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setErrorOpen(true);
    } finally {
      setSavingKey(false);
    }
  };

  const retrieveSets = async () => {
    setWaiting(true);
    setErrorOpen(false);
    try {
      window.electron.store.set('eventId', eventId.trim());
      window.electron.store.set('station', station.trim());
      window.electron.store.set('vodUrl', vodUrl.trim());
      const result = await retrieveTournamentSets(
        client,
        eventId.trim(),
        station.trim()
      );
      let sets: VODMetadata[] = [];
      if (result.sets.length) {
        let characterMap: CharacterMap =
          window.electron.store.get('characterMap');
        if (!characterMap) {
          const { data } = await client.query<CharactersResponse>({
            query: GET_ALL_CHARACTERS,
            variables: { gameid: 1386 },
            fetchPolicy: 'network-only',
          });
          characterMap = {};
          (data.videogame?.characters ?? []).forEach((character) => {
            characterMap[character.id] = character.name;
          });
          window.electron.store.set('characterMap', characterMap);
        }
        const timestamp =
          await window.electron.ipcRenderer.retrieveVideoInformation({
            vodUrl: vodUrl.trim(),
          });
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
      navigate('/SetsView', {
        state: {
          sets,
          vodUrl: vodUrl.trim(),
          tournamentName: result.tournamentName,
          skippedSets: result.skippedSets,
          eventId: eventId.trim(),
          station: station.trim(),
        },
      });
    } catch (error) {
      setErrorMessage(
        `Error retrieving sets: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setErrorOpen(true);
    } finally {
      setWaiting(false);
    }
  };

  return (
    <div className="source-form">
      {SnackbarPopup(errorMessage, 'error', errorOpen, setErrorOpen)}
      {SnackbarPopup(infoMessage, 'info', infoOpen, setInfoOpen)}
      <section className="source-inputs" aria-label="Tournament source">
        <TextField
          error={slugError}
          className="textfield"
          label="Start.GG Event Slug"
          required
          variant="outlined"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          disabled={waiting || choosingOutput}
          placeholder="tournament/name/event/name"
          helperText={slugError ? 'Use tournament/name/event/name.' : undefined}
        />
        <TextField
          error={urlError}
          className="textfield"
          label="VOD Link"
          required
          variant="outlined"
          value={vodUrl}
          onChange={(event) => setVodUrl(event.target.value)}
          disabled={waiting || choosingOutput}
          placeholder="https://www.twitch.tv/videos/123456789"
          helperText={urlError ? 'Enter a valid HTTP or HTTPS URL.' : undefined}
        />
        <TextField
          className="textfield"
          label="Stream Station"
          required
          variant="outlined"
          value={station}
          onChange={(event) => setStation(event.target.value)}
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
            if (
              value === PLAYERS_FIRST_TITLE ||
              value === TOURNAMENT_FIRST_TITLE
            )
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
            Use the start.gg event slug, such as{' '}
            <code>tournament/name/event/name</code>, and the Twitch VOD URL,
            such as <code>https://www.twitch.tv/videos/123456789</code>. Stream
            Station accepts a Twitch channel name or station number.
          </p>
        </details>
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
        {blockedReason && !waiting && (
          <p className="help" id="source-requirements" role="status">
            {blockedReason}
          </p>
        )}
        {waiting && (
          <div className="loading-sets" role="status">
            <p className="help">Retrieving sets and VOD start time...</p>
            <LinearProgress />
          </div>
        )}
      </section>
      <aside className="source-settings" aria-label="Source settings">
        <TextField
          required
          type="password"
          label="Start.gg API key"
          variant="outlined"
          value={keyDraft}
          onChange={(event) => setKeyDraft(event.target.value)}
          disabled={!settingsReady || savingKey || waiting || choosingOutput}
        />
        <Button
          variant="outlined"
          disabled={
            !settingsReady ||
            savingKey ||
            waiting ||
            choosingOutput ||
            keyDraft.trim() === apiKey
          }
          onClick={saveKey}
        >
          {savingKey ? 'Saving API key...' : 'Save API Key'}
        </Button>
        <details className="help-disclosure">
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
        <OutputFolder
          disabled={waiting || savingKey}
          onChoosingChange={onChoosingOutput}
        />
      </aside>
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
