import { createRef, useState, useEffect, ReactInstance } from 'react';
import { Button, Box, TextField } from '@mui/material';
import { GET_SETS_AT_STATION } from 'renderer/common/StartggQueries';
import { useLazyQuery } from '@apollo/client';
import { useTheme } from '@mui/material/styles';
import { PropagateLoader } from 'react-spinners';
import { useNavigate } from 'react-router-dom';
import HiddenTextField from 'renderer/common/HiddenTextField';
import SnackbarPopup from 'renderer/common/SnackbarPopup';

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

const RetrieveSets = (
  eventId: string,
  vodUrl: string,
  stationNumber: number,
  buttonDisabled: boolean,
  setButtonDisabled: React.Dispatch<React.SetStateAction<boolean>>,
): JSX.Element => {
  const navigate = useNavigate();
  const theme = useTheme();
  let options = {};
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
  let characters = ['', ''];

  const [getSets, { loading, error, data }] = useLazyQuery(
    GET_SETS_AT_STATION,
    options
  );

  useEffect(() => {
    if (loading || waiting) {
      setButtonDisabled(true)
    } else if (error) {
      setButtonDisabled(false)
    }
  })

  useEffect(() => {
    if (data) {
      window.electron.ipcRenderer
        .retrieveVideoInformation({ vodUrl: vodUrl })
        .then((timestamp) => {
          let characterMap = window.electron.store.get('characterMap');
          const formattedSets = data.event.sets.nodes.map((set: any) => {
            let characterStrings = ['', ''];
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
              characters[0] = characterArrays[0][0]
              characters[1] = characterArrays[1][0]
            }
            let metadata: VODMetadata = {
              title:
                set.slots[0].entrant.name.split('|').pop().trim() +
                characterStrings[0] +
                ' vs ' +
                set.slots[1].entrant.name.split('|').pop().trim() +
                characterStrings[1] +
                ' - ' +
                set.fullRoundText +
                ' - ' +
                data.event.tournament.name,
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
              tournamentName: data.event.tournament.name,
            };
            return metadata;
          });
          setWaiting(false);
          console.log("All sets", formattedSets)
          navigate('/SetsView', {
            state: {
              sets: formattedSets,
              vodUrl: vodUrl,
              tournamentName: data.event.tournament.name,
            },
          });
        }).catch((err) => {
          setErrorMessage("Error retrieving sets: " + err.message);
          setErrorOpen(true);
          setWaiting(false);
        });
    }
  }, [data]);

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
          setWaiting(true);
          getSets({
            variables: { eventId: eventId, stationNumbers: [stationNumber] },
          });
        }}
        sx={{ marginBottom: '25px', width: '100%' }}
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
  const [vodUrl, setVodUrl] = useState('');
  const [eventId, setEventId] = useState('');
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [stationNumber, setStationNumber] = useState(0);
  const [urlError, setUrlError] = useState(false);
  const [slugError, setSlugError] = useState(false);

  const onChangeFunc = (value: any) => {
    window.electron.store.set('apikey', value);
  };

  useEffect(() => {
    if (
      eventId != '' &&
      vodUrl != '' &&
      stationNumber != 0 &&
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
    var res = url.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
    return (res !== null)
  };

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

  return (
    <Box className="background-card">
      {HiddenTextField(
        'Start.GG API Key',
        'https://start.gg/admin/profile/developer',
        window.electron.store.get('apikey'),
        onChangeFunc,
        false
      )}
      <TextField
        error={slugError}
        className="textfield"
        label="Start.GG Event Slug"
        variant="filled"
        onBlur={(event) => setEventId(event.target.value)}
        helperText="tournament/tournament-name/event/event-name"
      />
      <TextField
        error={urlError}
        className="textfield"
        label="VOD Link"
        variant="filled"
        onBlur={(event) => setVodUrl(event.target.value)}
        helperText="https://www.twitch.tv/videos/123456789"
      />
      <TextField
        className="textfield"
        label="Stream Station Number"
        type="number"
        variant="filled"
        onChange={(event) => setStationNumber(parseInt(event.target.value))}
        helperText="The station number the stream is assigned to."
        sx={{ marginBottom: '25px' }}
      />
      {RetrieveSets(eventId, vodUrl, stationNumber, buttonDisabled, setButtonDisabled)}
    </Box>
  );
};

export default VideoSearch;
