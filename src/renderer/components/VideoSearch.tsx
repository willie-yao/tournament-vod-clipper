import { useState, useEffect } from 'react';
import { Button, Box, TextField, Dialog, MenuItem, Typography } from '@mui/material';
import {
  GET_SETS_AT_STATION,
  GET_SETS_AT_STREAM_STATION,
} from 'renderer/common/StartggQueries';
import { useLazyQuery, useApolloClient } from '@apollo/client';
import { useTheme } from '@mui/material/styles';
import { PropagateLoader } from 'react-spinners';
import { useNavigate } from 'react-router-dom';
import SnackbarPopup from 'renderer/common/SnackbarPopup';
import SettingsIcon from '@mui/icons-material/Settings';

export interface VODMetadata {
  title: string;
  startTime: string;
  endTime: string;
  download: boolean;
  player1: string;
  player2: string;
  character1: string;
  character2: string;
  tournamentName: string;
}

function isNumber(value: string | number): boolean {
  return value != null && value !== '' && !isNaN(Number(value.toString()));
}

const PlayersFirstOption = "Players - Round - Tournament Name"
const TournamentFirstOption = "Tournament Name: Players - Round"

const RetrieveSets = (
  eventId: string,
  vodUrl: string,
  station: string,
  titleFormat: string,
  buttonDisabled: boolean,
  setButtonDisabled: React.Dispatch<React.SetStateAction<boolean>>
): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  const client = useApolloClient();
  let options = {};
  let pageNum = 1;
  let apikey = window.electron.store.get('apikey');
  if (apikey != '') {
    options = {
      context: {
        headers: {
          authorization: `Bearer ${apikey}`,
        },
      },
    };
  }

  const [waiting, setWaiting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorOpen, setErrorOpen] = useState(false);
  let totalData: any[] = [];

  let query;
  isNumber(station)
    ? (query = GET_SETS_AT_STATION)
    : (query = GET_SETS_AT_STREAM_STATION);

  const formatSetData = (responseData: any) => {
    window.electron.ipcRenderer
      .retrieveVideoInformation({ vodUrl: vodUrl })
      .then((timestamp) => {
        let characterMap = window.electron.store.get('characterMap');
        const formattedSets = responseData.event.sets.nodes.map((set: any) => {
          let characterStrings = ['', ''];
          let characters = ['Random Character', 'Random Character'];
          if (set.games != null) {
            let characterArrays: string[][] = [[], []];
            for (const game of set.games) {
              if (game.selections != null) {
                let entrantIds = [
                  set.slots[0].entrant.id,
                  set.slots[1].entrant.id,
                ];
                for (let i = 0; i < 2; i++) {
                  for (let j = 0; j < 2; j++) {
                    if (game.selections[j].entrant.id == entrantIds[i]) {
                      let character: string =
                        characterMap[game.selections[j].selectionValue];
                      characterArrays[i].indexOf(character) === -1
                        ? characterArrays[i].push(character)
                        : null;
                    }
                  }
                }
              }
            }
            characterStrings[0] = ' (' + characterArrays[0].join(', ') + ')';
            characterStrings[1] = ' (' + characterArrays[1].join(', ') + ')';
            characters[0] = characterArrays[0][0];
            characters[1] = characterArrays[1][0];
          }
          let title = '';
          if (titleFormat == PlayersFirstOption) {
            title = set.slots[0].entrant.name.split('|').pop().trim() +
            characterStrings[0] +
            ' vs ' +
            set.slots[1].entrant.name.split('|').pop().trim() +
            characterStrings[1] +
            ' - ' +
            set.fullRoundText +
            ' - ' +
            responseData.event.tournament.name
          } else if (titleFormat == TournamentFirstOption) {
            title = responseData.event.tournament.name +
            ': ' +
            set.slots[0].entrant.name.split('|').pop().trim() +
            characterStrings[0] +
            ' vs ' +
            set.slots[1].entrant.name.split('|').pop().trim() +
            characterStrings[1] +
            ' - ' +
            set.fullRoundText
          }
          let metadata: VODMetadata = {
            title: title,
            startTime: new Date((set.startedAt - timestamp) * 1000)
              .toISOString()
              .slice(11, 19),
            endTime: new Date((set.completedAt - timestamp) * 1000)
              .toISOString()
              .slice(11, 19),
            download: true,
            player1: set.slots[0].entrant.name.split('|').pop().trim(),
            player2: set.slots[1].entrant.name.split('|').pop().trim(),
            character1: characters[0],
            character2: characters[1],
            tournamentName: responseData.event.tournament.name,
          };
          return metadata;
        });
        setWaiting(false);
        console.log('All sets', formattedSets);
        navigate('/SetsView', {
          state: {
            sets: formattedSets,
            vodUrl: vodUrl,
            tournamentName: responseData.event.tournament.name,
          },
        });
      })
      .catch((err) => {
        setErrorMessage('Error retrieving sets: ' + err.message);
        setErrorOpen(true);
        setWaiting(false);
      });
  };

  const [getSets, { loading, error, data }] = useLazyQuery(query, options);

  useEffect(() => {
    if (loading || waiting) {
      setButtonDisabled(true);
    } else if (error) {
      setButtonDisabled(false);
    }
  });

  useEffect(() => {
    if (data && isNumber(station)) {
      formatSetData(data);
    }
  }, [data]);

  const getNextPage = async () => {
    await client
      .query({
        query: GET_SETS_AT_STREAM_STATION,
        variables: { eventId: eventId, page: pageNum },
      })
      .then((res: any) => {
        totalData.push(
          res.data.event.sets.nodes.filter(
            (set: any) => set.stream && set.stream.streamName == station
          )
        );
        pageNum++;
      });
  };

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {SnackbarPopup(errorMessage, 'error', errorOpen, setErrorOpen)}
      <Button
        variant="contained"
        onClick={() => {
          window.electron.store.set('eventId', eventId);
          window.electron.store.set('station', station);
          window.electron.store.set('vodUrl', vodUrl);
          setWaiting(true);
          if (isNumber(station)) {
            getSets({
              variables: { eventId: eventId, stationNumbers: [station] },
            });
          } else {
            client
              .query({
                query: GET_SETS_AT_STREAM_STATION,
                variables: { eventId: eventId, page: pageNum },
              })
              .then(async (res: any) => {
                totalData.push(
                  res.data.event.sets.nodes.filter(
                    (set: any) => set.stream && set.stream.streamName == station
                  )
                );
                pageNum++;
                while (pageNum < res.data.event.sets.pageInfo.totalPages) {
                  await getNextPage();
                }
                let dataCopy = structuredClone(res.data);
                dataCopy.event.sets.nodes = totalData.flat();
                formatSetData(dataCopy);
              });
          }
        }}
        sx={{ marginBottom: '25px', width: '95%' }}
        disabled={buttonDisabled}
      >
        Retrieve Sets
      </Button>
      {(loading || waiting) && (
        <PropagateLoader color={theme.palette.secondary.dark} />
      )}
      {error && <p>{error.message}</p>}
    </Box>
  );
};

const VideoSearch = () => {
  const [vodUrl, setVodUrl] = useState(window.electron.store.get('vodUrl') || '');
  const [eventId, setEventId] = useState(window.electron.store.get('eventId') || '');
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [station, setStation] = useState(window.electron.store.get('station') || '');
  const [open, setOpen] = useState(false);
  const [urlError, setUrlError] = useState(false);
  const [slugError, setSlugError] = useState(false);
  const [titleFormat, setTitleFormat] = useState(PlayersFirstOption);

  useEffect(() => {
    if (
      eventId != '' &&
      vodUrl != '' &&
      station != '' &&
      window.electron.store.get('apikey') &&
      !urlError &&
      !slugError
    ) {
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
  });

  function isValidURL(url: string) {
    var res = url.match(
      /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g
    );
    return res !== null;
  }

  useEffect(() => {
    if (isValidURL(vodUrl) || vodUrl == '') {
      setUrlError(false);
    } else {
      setUrlError(true);
    }
  });

  useEffect(() => {
    if (
      eventId.match(/tournament\/([a-zA-Z0-9_-]+)\/event\/([a-zA-Z0-9_-]+)/g) ||
      eventId == ''
    ) {
      setSlugError(false);
    } else {
      setSlugError(true);
    }
  });

  const SettingsModal = () => {

    return (
      <Dialog
        open={open}
        onClose={(event: any) => {
          event.stopPropagation();
          setOpen(false);
        }}
      >
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: '20vh',
          minWidth: '50vw',
          padding: '20px',
        }}>
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
            onChange={(event) =>
              setTitleFormat(event.target.value as string)
            }
            select
          >
            <MenuItem value={PlayersFirstOption}>{PlayersFirstOption}</MenuItem>
            <MenuItem value={TournamentFirstOption}>{TournamentFirstOption}</MenuItem>
          </TextField>
        </Box>
      </Dialog>
    )
  }

  return (
    <Box className="background-card" sx={{ height: '58vh' }}>
      {SettingsModal()}
      <TextField
        error={slugError}
        className="textfield"
        label="Start.GG Event Slug"
        defaultValue={eventId}
        variant="filled"
        onBlur={(event) => setEventId(event.target.value)}
        helperText="tournament/tournament-name/event/event-name"
      />
      <TextField
        error={urlError}
        className="textfield"
        label="VOD Link"
        defaultValue={vodUrl}
        variant="filled"
        onBlur={(event) => setVodUrl(event.target.value)}
        helperText="https://www.twitch.tv/videos/123456789"
      />
      <TextField
        className="textfield"
        label="Stream Station"
        defaultValue={station}
        variant="filled"
        onChange={(event) => setStation(event.target.value)}
        helperText="Name of a twitch channel or a station number."
        sx={{ marginBottom: '25px' }}
      />
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Button
          variant="contained"
          color="secondary"
          sx={{ marginBottom: '25px', width: '95%', color: 'white' }}
          onClick={() => setOpen(true)}
        >
          Additional Options
        </Button>
      </Box>
      {RetrieveSets(
        eventId,
        vodUrl,
        station,
        titleFormat,
        buttonDisabled,
        setButtonDisabled
      )}
    </Box>
  );
};

export default VideoSearch;
