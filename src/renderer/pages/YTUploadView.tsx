import { Button, Box, TextField, Typography } from '@mui/material';
import { useState, useEffect } from 'react';
import HiddenTextField from 'renderer/common/HiddenTextField';

const YTUploadView = () => {

  const [ytEmail, setYtEmail] = useState("")
  const [videos, setVideos] = useState<string[]>([])
  const path = "./downloadedVODs"

  useEffect(() => {
    window.electron.ipcRenderer.getVideosFromFolder(path).then((result) => {
      console.log("videos", result)
      setVideos(result)
    })
  }, [])

  const onYtPasswordChange = (value: any) => {
    window.electron.store.setSecret('ytPassword', value)
  }

  const uploadVideos = () => {
    const params = {
      path: './downloadedVODs',
      email: ytEmail,
    }
    window.electron.ipcRenderer.uploadVideos(params)
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" textAlign="center" gutterBottom>
        Upload to YouTube
      </Typography>
      <Box className="background-card">
        <TextField
          className="textfield"
          label="YouTube Email"
          variant="filled"
          onChange={(event) => setYtEmail(event.target.value)}
        />
        {HiddenTextField("YouTube Password", "", onYtPasswordChange)}
        <Button
          variant="contained"
          color="secondary"
          sx={{ width: '40vw', marginTop: '20px', color: 'white' }}
          onClick={() => uploadVideos()}
        >
          Upload
        </Button>
      </Box>
    </Box>
  )
}

export default YTUploadView
