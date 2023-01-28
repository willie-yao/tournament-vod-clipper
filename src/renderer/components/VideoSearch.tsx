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

export interface VODMetadata {
  title: string;
  startTime: string;
  endTime: string;
  download: boolean;
}

const RetrieveSets = (
  eventId: string,
  vodUrl: string,
  setter: React.Dispatch<React.SetStateAction<VODMetadata[]>>
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

  const [getSets, { loading, error, data }] = useLazyQuery(
    GET_ALL_SETS_AT_EVENT,
    options
  );
  let formattedSets: VODMetadata[] = [];

  useEffect(() => {
    if (data) {
      window.electron.ipcRenderer
        .retrieveVideoInformation({ vodUrl: vodUrl })
        .then((timestamp) => {
          console.log('timestamp', timestamp);
          console.log('data', data);
          let sets = data.event.sets.nodes;
          for (let i = 0; i < sets.length; i++) {
            let metadata: VODMetadata = {
              title:
                sets[i].slots[0].entrant.name +
                ' vs ' +
                sets[i].slots[1].entrant.name +
                ' - ' +
                sets[i].fullRoundText,
              startTime: new Date((sets[i].startedAt - timestamp) * 1000)
                .toISOString()
                .slice(11, 19),
              endTime: new Date((sets[i].completedAt - timestamp) * 1000)
                .toISOString()
                .slice(11, 19),
              download: true,
            };
            console.log('metadata', metadata);
            formattedSets.push(metadata);
            setter((old) => [...old, metadata]);
          }
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
      {loading && <MoonLoader color={theme.palette.secondary.dark} />}
      {error && <p>{error.message}</p>}
      <Button
        variant="contained"
        onClick={() => getSets({ variables: { eventId: eventId } })}
        sx={{ marginBottom: '25px', width: '100%' }}
      >
        Retrieve Sets
      </Button>
    </Box>
  );
};

const VideoSearch = () => {
  const theme = useTheme();

  const [vodUrl, setVodUrl] = useState('');
  const [eventId, setEventId] = useState('');
  const [retrievedSets, setRetrievedSets] = useState<VODMetadata[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  return (
    <Box className="background-card">
      <TextField
        className="textfield"
        label="Start.GG API Key"
        variant="filled"
        defaultValue={window.electron.store.get('apikey')}
        type={showPassword ? 'text' : 'password'}
        onChange={(event) =>
          window.electron.store.set('apikey', event.target.value)
        }
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="toggle password visibility"
                onClick={handleClickShowPassword}
                onMouseDown={handleMouseDownPassword}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
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
      {RetrieveSets(eventId, vodUrl, setRetrievedSets)}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '30vh',
          overflow: 'auto',
          marginBottom: '25px',
        }}
      >
        {retrievedSets.map((set, index) => {
          return <div key={index}>{set.title}</div>;
        })}
      </Box>
      <Button
        variant="contained"
        sx={{ marginBottom: '25px' }}
        onClick={() => {
          for (let i = 0; i < 4; i++) {
            window.electron.ipcRenderer.downloadVideo({
              vodUrl: vodUrl,
              title: retrievedSets[i].title,
              startTime: retrievedSets[i].startTime,
              endTime: retrievedSets[i].endTime,
            });
          }
        }}
      >
        Download VODs
      </Button>
    </Box>
  );
};

export default VideoSearch;
