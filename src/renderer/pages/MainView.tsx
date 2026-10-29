import { useState, useEffect } from 'react';
import {
  Button,
  Box,
  Container,
  TextField,
  Dialog,
  Link,
  MenuItem,
  Typography,
} from '@mui/material';
import { useApolloClient } from '@apollo/client';
import { useTheme } from '@mui/material/styles';
import { PropagateLoader } from 'react-spinners';
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
import NavMenu from '../common/NavMenu';
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
}

const VideoSearch = ({ choosingOutput, onChoosingOutput }: SearchProps) => {
  const client = useApolloClient();
  const navigate = useNavigate();
  const theme = useTheme();
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
  const [open, setOpen] = useState(false);
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
    <Box className="background-card" sx={{ minHeight: '58vh' }}>
      {SnackbarPopup(errorMessage, 'error', errorOpen, setErrorOpen)}
      {SnackbarPopup(infoMessage, 'info', infoOpen, setInfoOpen)}
      <OutputFolder
        disabled={waiting || savingKey}
        onChoosingChange={onChoosingOutput}
      />
      <TextField
        required
        type="password"
        label="Start.gg API key"
        variant="filled"
        className="textfield"
        value={keyDraft}
        onChange={(event) => setKeyDraft(event.target.value)}
        disabled={!settingsReady || savingKey || waiting || choosingOutput}
        helperText="Stored securely on this device. Save changes before retrieving sets."
      />
      <Button
        variant="contained"
        color="secondary"
        sx={{ width: '95%', marginBottom: '20px' }}
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
      <TextField
        error={slugError}
        className="textfield"
        label="Start.GG Event Slug"
        variant="filled"
        value={eventId}
        onChange={(event) => setEventId(event.target.value)}
        disabled={waiting || choosingOutput}
        helperText="tournament/tournament-name/event/event-name"
      />
      <TextField
        error={urlError}
        className="textfield"
        label="VOD Link"
        variant="filled"
        value={vodUrl}
        onChange={(event) => setVodUrl(event.target.value)}
        disabled={waiting || choosingOutput}
        helperText="https://www.twitch.tv/videos/123456789"
      />
      <TextField
        className="textfield"
        label="Stream Station"
        variant="filled"
        value={station}
        onChange={(event) => setStation(event.target.value)}
        disabled={waiting || choosingOutput}
        helperText="Name of a twitch channel or a station number."
        sx={{ marginBottom: '25px' }}
      />
      <Button
        variant="contained"
        color="secondary"
        sx={{ marginBottom: '25px', width: '95%', color: 'white' }}
        disabled={waiting || choosingOutput}
        onClick={() => setOpen(true)}
      >
        Additional Options
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <Box sx={{ padding: '20px', minWidth: '50vw' }}>
          <Typography
            variant="h6"
            component="h2"
            textAlign="center"
            gutterBottom
          >
            Additional Options
          </Typography>
          <TextField
            value={titleFormat}
            sx={{ width: '100%' }}
            label="Video Title Format"
            variant="filled"
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
            <MenuItem value={PLAYERS_FIRST_TITLE}>
              {PLAYERS_FIRST_TITLE}
            </MenuItem>
            <MenuItem value={TOURNAMENT_FIRST_TITLE}>
              {TOURNAMENT_FIRST_TITLE}
            </MenuItem>
          </TextField>
        </Box>
      </Dialog>
      <Button
        variant="contained"
        disabled={disabled}
        onClick={retrieveSets}
        sx={{ marginBottom: '25px', width: '95%' }}
      >
        Retrieve Sets
      </Button>
      {waiting && <PropagateLoader color={theme.palette.secondary.dark} />}
    </Box>
  );
};

const MainView = () => {
  const [choosingOutput, setChoosingOutput] = useState(false);
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4, alignContent: 'center' }}>
        {NavMenu('/', choosingOutput)}
        <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
          Tournament VOD Clipper
        </Typography>
        <VideoSearch
          choosingOutput={choosingOutput}
          onChoosingOutput={setChoosingOutput}
        />
        <Typography variant="body2" color="text.secondary" align="center">
          {'Copyright © '}
          <Link color="inherit" href="https://github.com/willie-yao">
            quillie ^^
          </Link>{' '}
          {new Date().getFullYear()}.
        </Typography>
      </Box>
    </Container>
  );
};

export default MainView;
