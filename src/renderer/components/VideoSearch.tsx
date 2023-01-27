import { useState, useEffect } from 'react';
import { Button, Box, TextField } from '@mui/material';
import { GET_ALL_SETS_AT_EVENT } from 'renderer/common/StartggQueries';
import { useLazyQuery } from '@apollo/client';

const RetrieveSets = (eventId: string): JSX.Element => {
  const [getSets, { loading, error, data }] = useLazyQuery(GET_ALL_SETS_AT_EVENT)
  const [retrievedSets, setRetrievedSets] = useState<string[]>([])

  useEffect(() => {
    if (data) {
      console.log("data", data)
      let sets = data.event.sets.nodes
      for (let i = 0; i < sets.length; i++) {
        let title = sets[i].slots[0].entrant.name + " vs " + sets[i].slots[1].entrant.name + " - " + sets[i].fullRoundText
        setRetrievedSets(old => [...old, title]);
      }
    }
  }, [data])

  if (loading) return <p>Loading ...</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <Button 
      variant="contained" 
      onClick={() => getSets({variables: {eventId: eventId}})}
    >
      Get Sets
    </Button>
  )
}

const VideoSearch = () => {
  const [vodUrl, setVodUrl] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endTime, setEndTime] = useState("")
  const [eventId, setEventId] = useState("")

  const downloadArgs = {
    vodUrl: vodUrl,
    startTime: startTime,
    endTime: endTime,
    eventID: eventId
  }

  return(
    <Box sx={{display: 'flex', flexDirection: 'column', height: '50vh', justifyContent: 'space-around'}}>
      <TextField id="outlined-basic" label="Start.GG Event ID" variant="outlined" onChange={(event) => setEventId(event.target.value)} />
      <TextField id="outlined-basic" label="VOD Link" variant="outlined" onChange={(event) => setVodUrl(event.target.value)} />
      {RetrieveSets(eventId)}
      <TextField id="outlined-basic" label="Start" variant="outlined" onChange={(event) => setStartTime(event.target.value)} />
      <TextField id="outlined-basic" label="End" variant="outlined" onChange={(event) => setEndTime(event.target.value)} />
      <Button 
        variant="contained" 
        onClick={() => window.electron.ipcRenderer.downloadVideo(downloadArgs)}
      >
        Download VODs
      </Button>
    </Box>
  )
}

export default VideoSearch
