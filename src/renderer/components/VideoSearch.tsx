import { useState, useEffect } from 'react';
import {
  Button,
  Box,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { GET_ALL_SETS_AT_EVENT } from 'renderer/common/StartggQueries';
import { useLazyQuery } from '@apollo/client';
import { useTheme } from '@mui/material/styles';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { MoonLoader } from 'react-spinners';
import { useNavigate } from 'react-router-dom';
import HiddenTextField from 'renderer/common/HiddenTextField';

export interface VODMetadata {
  title: string;
  startTime: string;
  endTime: string;
  download: boolean;
}

const RetrieveSets = (eventId: string, vodUrl: string): JSX.Element => {
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

  const [getSets, { loading, error, data }] = useLazyQuery(
    GET_ALL_SETS_AT_EVENT,
    options
  );

  useEffect(() => {
    if (data) {
      window.electron.ipcRenderer
        .retrieveVideoInformation({ vodUrl: vodUrl })
        .then((timestamp) => {
          let characterMap = window.electron.store.get('characterMap')
          const formattedSets = data.event.sets.nodes.map((set: any) => {
            let characterStrings = ["", ""]
            if (set.games != null) {
              let characterArrays: string[][] = [[], []]
              for (const game of set.games) {
                if (game.selections != null) {
                  let entrantIds = [set.slots[0].entrant.id, set.slots[1].entrant.id]
                  for (let i = 0; i < 2; i++) {
                    for (let j = 0; j < 2; j++) {
                      if (game.selections[j].entrant.id == entrantIds[i]) {
                        let character: string = characterMap[game.selections[j].selectionValue]
                        characterArrays[i].indexOf(character) === -1 ? characterArrays[i].push(character) : null
                      }
                    }
                  }
                }
              }
              characterStrings[0] = " (" + characterArrays[0].join(', ') + ")"
              characterStrings[1] = " (" + characterArrays[1].join(', ') + ")"
            }
            let metadata: VODMetadata = {
              title:
                set.slots[0].entrant.name + 
                characterStrings[0] +
                ' vs ' +
                set.slots[1].entrant.name +
                characterStrings[1] +
                ' - ' +
                set.fullRoundText,
              startTime: new Date((set.startedAt - timestamp) * 1000)
                .toISOString()
                .slice(11, 19),
              endTime: new Date((set.completedAt - timestamp) * 1000)
                .toISOString()
                .slice(11, 19),
              download: true,
            };
            return metadata;
          });
          navigate('/SetsView', {
            state: { sets: formattedSets, vodUrl: vodUrl },
          });
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
      }}
    >
      <Button
        variant="contained"
        onClick={() => getSets({ variables: { eventId: eventId } })}
        sx={{ marginBottom: '25px', width: '100%' }}
      >
        Retrieve Sets
      </Button>
      {loading && <MoonLoader color={theme.palette.secondary.dark} />}
      {error && <p>{error.message}</p>}
    </Box>
  );
};

const VideoSearch = () => {

  const [vodUrl, setVodUrl] = useState('');
  const [eventId, setEventId] = useState('');

  const onChangeFunc = (value: any) => {
    window.electron.store.set('apikey', value)
  }

  return (
    <Box className="background-card">
      {HiddenTextField("Start.GG API Key", window.electron.store.get('apikey'), onChangeFunc)}
      <TextField
        className="textfield"
        label="Start.GG Event ID"
        variant="filled"
        onChange={(event) => setEventId(event.target.value)}
      />
      <TextField
        className="textfield"
        label="VOD Link"
        variant="filled"
        onChange={(event) => setVodUrl(event.target.value)}
      />
      {RetrieveSets(eventId, vodUrl)}
    </Box>
  );
};

export default VideoSearch;
