import * as React from 'react';
import { useState } from 'react';
import { Button, Box, TextField } from '@mui/material';
import { BACKEND_URL } from '../config';
import axios from 'axios';

const getClip = (url, startTime, endTime) => {
  // https://www.twitch.tv/videos/1709685150
  axios({
    method: 'post',
    url: BACKEND_URL + '/downloadVideo',
    data: {
      "url": url,
      "startTime": startTime,
      "endTime": endTime
    }
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
        onClick={() => getClip(vodUrl, startTime, endTime)}
      >
        Search
      </Button>
    </Box>
  )
}

export default VideoSearch
