import {
  Container,
  Button,
  Box,
  MenuItem,
  TextField,
  Typography,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import { useState, useEffect } from 'react';
import NavMenu from 'renderer/common/NavMenu';
import SnackbarPopup from 'renderer/common/SnackbarPopup';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const YTUploadView = () => {
  const [description, setDescription] = useState('');
  const [tounamentFolders, setTournamentFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [visibility, setVisibility] = useState('unlisted');
  const [loggedIn, setLoggedIn] = useState(false);
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const path = './downloadedVODs';

  useEffect(() => {
    window.electron.ipcRenderer.getTournamentFolders(path).then((result) => {
      console.log('folders: ', result);
      setTournamentFolders(result);
    });
  }, []);

  useEffect(() => {
    if (selectedFolder != '' && loggedIn) {
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
  });

  const login = () => {
    window.electron.ipcRenderer
      .openGoogleLogin('hello')
      .then((token) => {
        setAccessToken(token.access_token);
      })
      .then(() => {
        setSuccessMessage('Login successful!');
        setSuccessOpen(true);
        setLoggedIn(true);
      })
      .catch((err) => {
        setErrorMessage('Error logging in: ' + err);
        setErrorOpen(true);
      });
  };

  const uploadVideos = () => {
    setInfoMessage(
      'Your videos are being uploaded! Check your YouTube account for progress updates.'
    );
    setInfoOpen(true);
    window.electron.ipcRenderer
      .createPlaylist({
        description: description,
        playlistName: selectedFolder,
        accessToken: accessToken,
        visibility: visibility,
      })
      .then((playlistResponse) => {
        console.log('playlist response', playlistResponse);
        window.electron.ipcRenderer
          .getVideosInFolder('./downloadedVODs/' + selectedFolder + '/')
          .then((result) => {
            console.log('videos: ', result);
            result.forEach((video: any) => {
              const params = {
                path: './downloadedVODs/' + selectedFolder + '/',
                description: description,
                playlistName: selectedFolder,
                accessToken: accessToken,
                visibility: visibility,
                videoName: video,
              };
              window.electron.ipcRenderer
                .uploadSingleVideo(params)
                .then((videoResponse) => {
                  console.log('video response', videoResponse);
                  setSuccessMessage('Upload successful!');
                  setSuccessOpen(true);
                  const thumbnailParams = {
                    folderName: selectedFolder,
                    videoName: video.replace(/\.[^/.]+$/, ''),
                    videoId: videoResponse.id,
                    accessToken: accessToken,
                  };
                  window.electron.ipcRenderer
                    .uploadThumbnail(thumbnailParams)
                    .then((thumbnailRes) => {
                      console.log('thumbnail response', thumbnailRes);
                    });

                  const playlistParams = {
                    playlistId: playlistResponse.id,
                    videoId: videoResponse.id,
                    accessToken: accessToken,
                  };

                  window.electron.ipcRenderer
                    .addVideoToPlaylist(playlistParams)
                    .then((playlistRes) => {
                      console.log('playlist response', playlistRes);
                    });
                });
            });
          });
      });
  };

  return (
    <Container maxWidth="sm">
      {NavMenu('/YTUploadView')}
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
        Upload to YouTube
      </Typography>
      {SnackbarPopup(successMessage, 'success', successOpen, setSuccessOpen)}
      {SnackbarPopup(errorMessage, 'error', errorOpen, setErrorOpen)}
      {SnackbarPopup(infoMessage, 'info', infoOpen, setInfoOpen)}
      <Box className="background-card" sx={{ height: '50vh' }}>
        <Button
          disabled={loggedIn}
          variant="contained"
          color="secondary"
          sx={{ width: '100%', color: 'white' }}
          onClick={() => login()}
        >
          Login
        </Button>
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <TextField
            required
            disabled={!loggedIn}
            value={selectedFolder}
            onChange={(event) =>
              setSelectedFolder(event.target.value as string)
            }
            label="VOD Folder"
            variant="filled"
            sx={{ width: '75%' }}
            select
          >
            {tounamentFolders.map((folder) => {
              return (
                <MenuItem key={folder} value={folder}>
                  {folder}
                </MenuItem>
              );
            })}
          </TextField>
          <Button
            disabled={!loggedIn}
            variant="contained"
            color="secondary"
            sx={{ width: '10%', color: 'white' }}
            onClick={() =>
              window.electron.ipcRenderer.openFolder(selectedFolder)
            }
          >
            <FolderOpenIcon />
          </Button>
        </Box>
        <TextField
          disabled={!loggedIn}
          onChange={(event) => setDescription(event.target.value as string)}
          label="Video Description"
          variant="filled"
          rows={3}
          multiline
        />
        <FormControl disabled={!loggedIn}>
          <RadioGroup
            row
            defaultValue="unlisted"
            name="radio-buttons-group"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
          >
            <FormControlLabel
              value="unlisted"
              control={<Radio />}
              label="Unlisted"
            />
            <FormControlLabel
              value="public"
              control={<Radio />}
              label="Public"
            />
            <FormControlLabel
              value="private"
              control={<Radio />}
              label="Private"
            />
          </RadioGroup>
        </FormControl>
        <Button
          disabled={buttonDisabled}
          variant="contained"
          color="secondary"
          sx={{ width: '100%', color: 'white' }}
          onClick={() => uploadVideos()}
        >
          Upload
        </Button>
      </Box>
    </Container>
  );
};

export default YTUploadView;
