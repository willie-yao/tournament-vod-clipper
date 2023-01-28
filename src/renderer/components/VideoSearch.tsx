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
  let formattedSets: VODMetadata[] = [];

  useEffect(() => {
    if (data) {
      window.electron.ipcRenderer
        .retrieveVideoInformation({ vodUrl: vodUrl })
        .then((timestamp) => {
          const formattedSets = data.event.sets.nodes.map((set: any) => {
            let metadata: VODMetadata = {
              title:
                set.slots[0].entrant.name +
                ' vs ' +
                set.slots[1].entrant.name +
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
  const theme = useTheme();

  const [vodUrl, setVodUrl] = useState('');
  const [eventId, setEventId] = useState('');
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
      {RetrieveSets(eventId, vodUrl)}
    </Box>
  );
};

export default VideoSearch;
