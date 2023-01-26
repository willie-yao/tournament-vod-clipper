import * as React from 'react';
import { useState } from 'react';
import { Button, Box, TextField } from '@mui/material';
// import { BACKEND_URL } from '../config';
import axios from 'axios';

const getClip = (url: string, startTime: string, endTime: string) => {
  let BACKEND_URL = "http://localhost:5000" // http://localhost:5000
  // https://www.twitch.tv/videos/1714445111
  console.log("Backendurl: " + BACKEND_URL)
  axios({
    method: 'get',
    responseType: 'blob',
    url: BACKEND_URL + '/downloadVideo/' + "?url=" + url + "&startTime=" + startTime + "&endTime=" + endTime,
    headers: { Accept: 'video/mp4;charset=UTF-8' },
    data: {
      "url": url,
      "startTime": startTime,
      "endTime": endTime
    }
  }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'video.mp4');
      document.body.appendChild(link);
      link.click();

      // clean up "a" element & remove ObjectURL
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
  });
}

const VideoSearch = () => {
  const [vodUrl, setVodUrl] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")

  return(
    <Box>
      <TextField id="outlined-basic" label="VOD Link" variant="outlined" onChange={(event) => setVodUrl(event.target.value)} />
      <TextField id="outlined-basic" label="Start" variant="outlined" onChange={(event) => setStartTime(event.target.value)} />
      <TextField id="outlined-basic" label="End" variant="outlined" onChange={(event) => setEndTime(event.target.value)} />
      <Button 
        variant="contained" 
        onClick={() => window.electron.ipcRenderer.downloadVideo("test")}
        // onClick={() => getClip(vodUrl, startTime, endTime)}
      >
        Search
      </Button>
    </Box>
  )
}

export default VideoSearch
