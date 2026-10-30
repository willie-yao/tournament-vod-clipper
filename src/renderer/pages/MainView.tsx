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
            titleFormat
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
          variant="outlined"
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          disabled={waiting || choosingOutput}
          helperText="tournament/tournament-name/event/event-name"
        />
        <TextField
          error={urlError}
          className="textfield"
          label="VOD Link"
          variant="outlined"
          value={vodUrl}
          onChange={(event) => setVodUrl(event.target.value)}
          disabled={waiting || choosingOutput}
          helperText="https://www.twitch.tv/videos/123456789"
        />
        <TextField
          className="textfield"
          label="Stream Station"
          variant="outlined"
          value={station}
          onChange={(event) => setStation(event.target.value)}
          disabled={waiting || choosingOutput}
          helperText="Name of a twitch channel or a station number."
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
        <Button variant="contained" disabled={disabled} onClick={retrieveSets}>
          {waiting ? 'Retrieving sets...' : 'Retrieve Sets'}
        </Button>
        {waiting && (
          <div className="loading-sets" role="status">
            <p className="help">
              Retrieving every page of matches and checking the VOD start
              time...
            </p>
            <LinearProgress />
          </div>
        )}
      </section>
      <aside className="source-settings">
        <h2>Source access</h2>
        <p className="help">
          Connect start.gg to retrieve matches for one stream or station. No
          videos are downloaded until you review the batch.
        </p>
        <TextField
          required
          type="password"
          label="Start.gg API key"
          variant="outlined"
          value={keyDraft}
          onChange={(event) => setKeyDraft(event.target.value)}
          disabled={!settingsReady || savingKey || waiting || choosingOutput}
          helperText="Stored securely on this device. Save changes before retrieving sets."
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
          Save API Key
        </Button>
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
          <h1>Build a tournament batch.</h1>
          <p>
            Bring in your stream and start.gg matches. Check the boundaries,
            choose your clips, then download the batch in one place.
          </p>
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
