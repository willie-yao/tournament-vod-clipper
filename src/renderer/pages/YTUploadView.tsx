import {
  Container,
  Button,
  Box,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useState, useEffect } from 'react';
import HiddenTextField from 'renderer/common/HiddenTextField';
import NavMenu from 'renderer/common/NavMenu';
import SnackbarPopup from 'renderer/common/SnackbarPopup';

const YTUploadView = () => {
  const [ytEmail, setYtEmail] = useState(
    window.electron.store.get('ytEmail')
      ? window.electron.store.get('ytEmail')
      : ''
  );
  const [ytRecoveryEmail, setYtRecoveryEmail] = useState(
    window.electron.store.get('ytRecoveryEmail')
      ? window.electron.store.get('ytRecoveryEmail')
      : ''
  );
  const [ytPassword, setYtPassword] = useState(
    window.electron.store.getSecret('ytPassword')
  );
  const [description, setDescription] = useState("")
  const [ytEmailError, setYtEmailError] = useState(false);
  const [ytRecoveryEmailError, setYtRecoveryEmailError] = useState(false);
  const [tounamentFolders, setTournamentFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const path = './downloadedVODs';

  useEffect(() => {
    window.electron.ipcRenderer.getTournamentFolders(path).then((result) => {
      console.log('folders: ', result);
      setTournamentFolders(result);
    });
  }, []);

  useEffect(() => {
    if (ytEmail != '' && ytPassword != '' && selectedFolder != '') {
      setButtonDisabled(false);
    } else {
      setButtonDisabled(true);
    }
  });

  useEffect(() => {
    if (
      ytEmail.match(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/) ||
      ytEmail == ''
    ) {
      setYtEmailError(false);
    } else {
      setYtEmailError(true);
    }
  });

  useEffect(() => {
    if (
      ytRecoveryEmail.match(
        /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
      ) ||
      ytRecoveryEmail == ''
    ) {
      setYtRecoveryEmailError(false);
    } else {
      setYtRecoveryEmailError(true);
    }
  });

  const onYtPasswordChange = (value: any) => {
    window.electron.store.setSecret('ytPassword', value);
  };

  const uploadVideos = () => {
    setInfoMessage('Your videos are being uploaded! Check your YouTube account for progress updates.');
    setInfoOpen(true);
    const params = {
      path: './downloadedVODs/' + selectedFolder + '/',
      email: ytEmail,
      recoveryemail: ytRecoveryEmail,
      description: description,
      playlistName: selectedFolder,
    };
    window.electron.ipcRenderer.openGoogleLogin("hello").then((token) => {
      setAccessToken(token.access_token)
    })
    // window.electron.ipcRenderer
    //   .uploadVideos(params)
    //   .then((result) => {
    //     setSuccessMessage('Upload complete! ' + result);
    //     setSuccessOpen(true);
    //   })
    //   .catch((error) => {
    //     setErrorMessage('Error uploading: ' + error);
    //     setErrorOpen(true);
    //   });
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
      <Box className="background-card" sx={{ height: '70vh' }}>
        <TextField
          required
          className="textfield"
          label="YouTube Email"
          variant="filled"
          defaultValue={ytEmail}
          error={ytEmailError}
          onChange={(event) => {
            window.electron.store.set('ytEmail', event.target.value);
            setYtEmail(event.target.value);
          }}
        />
        <TextField
          className="textfield"
          label="YouTube Recovery Email"
          variant="filled"
          defaultValue={ytRecoveryEmail}
          error={ytRecoveryEmailError}
          onChange={(event) => {
            window.electron.store.set('ytRecoveryEmail', event.target.value);
            setYtRecoveryEmail(event.target.value);
          }}
        />
        {HiddenTextField(
          'YouTube Password',
          '',
          ytPassword,
          onYtPasswordChange,
          true
        )}
        <TextField
          required
          value={selectedFolder}
          onChange={(event) => setSelectedFolder(event.target.value as string)}
          label="VOD Folder"
          variant="filled"
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
        <TextField
          onChange={(event) => setDescription(event.target.value as string)}
          label="Video Description"
          variant="filled"
          rows={3}
          multiline
        />
        <Button
          disabled={buttonDisabled}
          variant="contained"
          color="secondary"
          sx={{ width: '40vw', marginTop: '20px', color: 'white' }}
          onClick={() => uploadVideos()}
        >
          Upload
        </Button>
      </Box>
    </Container>
  );
};

export default YTUploadView;
