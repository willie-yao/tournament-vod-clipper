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

const YTUploadView = () => {
  const [ytEmail, setYtEmail] = useState(window.electron.store.get('ytEmail'));
  const [ytPassword, setYtPassword] = useState(
    window.electron.store.getSecret('ytPassword')
  );
  const [tounamentFolders, setTournamentFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const path = './downloadedVODs';

  useEffect(() => {
    window.electron.ipcRenderer.getTournamentFolders(path).then((result) => {
      console.log('folders: ', result);
      setTournamentFolders(result);
    });
  }, []);

  const onYtPasswordChange = (value: any) => {
    window.electron.store.setSecret('ytPassword', value);
  };

  const uploadVideos = () => {
    const params = {
      path: './downloadedVODs/' + selectedFolder + '/',
      email: ytEmail,
    };
    window.electron.ipcRenderer.uploadVideos(params);
  };

  return (
    <Container maxWidth="sm">
      {NavMenu('/YTUploadView')}
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
        Upload to YouTube
      </Typography>
      <Box className="background-card">
        <TextField
          className="textfield"
          label="YouTube Email"
          variant="filled"
          defaultValue={ytEmail}
          onChange={(event) => {
            window.electron.store.set('ytEmail', event.target.value);
            setYtEmail(event.target.value);
          }}
        />
        {HiddenTextField('YouTube Password', ytPassword, onYtPasswordChange)}
        <TextField
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
        <Button
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
